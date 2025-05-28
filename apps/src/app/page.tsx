'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { MAX_PLAYER } from './lib/config';

interface Player {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  role_id: string | null;
}

function generateRoomCode(): string {
  const min = 100000;
  const max = 999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function generateUserCode() {
  return 'User' + Math.floor(1000 + Math.random() * 9000);
}

export default function HomePage() {
  const router = useRouter();
  const [userCode, setUserCode] = useState('');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const existingCode = localStorage.getItem('user_code');
    
    if (existingCode) {
      setUserCode(existingCode);
    } else {
      const newCode = generateUserCode();
      localStorage.setItem('user_code', newCode);
      setUserCode(newCode);
    }
  }, []);
  useEffect(() => {
    const subscription = supabase
      .channel('player-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player' }, payload => {
        console.log('玩家更新:', payload);
        if (payload.eventType === 'INSERT') {
          setPlayers(prev => [...prev, payload.new as Player]);
        } else if (payload.eventType === 'DELETE') {
          setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();
  
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);
  // 創建房間，並建立房主玩家
  async function createRoom() {
    if (!userCode) {
      toast.error('無法獲取用戶信息');
      return;
    }

    setCreating(true);
    try {
      const code = generateRoomCode();
      console.log('正在創建房間，代碼：', code);

      // 創建房間
      const { data: room, error: roomErr } = await supabase
        .from("room")
        .insert([{ 
          room_code: parseInt(code, 10),
          status: 'waiting',
          script_id: null,
          host_id: null,
        }])
        .select()
        .single();

      if (roomErr) {
        console.error('創建房間失敗：', roomErr);
        toast.error('建立房間失敗：' + roomErr.message);
        return;
      }

      if (!room) {
        console.error('創建房間失敗：未返回房間數據');
        toast.error('建立房間失敗：未返回房間數據');
        return;
      }

      console.log('房間創建成功：', room);
      
      // 創建新玩家（不需要提供id，数据库会自动生成）
      const isHost = !players || players.length === 0;
      console.log('準備創建新玩家，房間ID:', room.id, '暱稱:', name || userCode, '是否為房主:', isHost);

      try {
        const { data: newPlayer, error: createErr } = await supabase
          .from('player')
          .insert([{
            room_id: room.id,
            name: name || userCode,
            is_host: isHost,
            role_id: null
          }])
          .select('id, room_id, name, is_host, role_id')
          .single();

        if (createErr) {
          console.error('创建玩家失败，錯誤詳情:', createErr);
          setError('創建玩家失敗: ' + createErr.message);
          setLoading(false);
          return;
        }

        if (!newPlayer) {
          console.error('创建玩家失败: 未返回玩家數據');
          setError('創建玩家失敗: 未返回玩家數據');
          setLoading(false);
          return;
        }

        console.log('成功创建新玩家:', newPlayer);
        
        // 保存玩家ID到localStorage
        localStorage.setItem(`player_id_${code}`, newPlayer.id);
        localStorage.setItem(`player_created_${code}`, 'true');

        // 如果是房主，更新房间的创建者ID
        if (isHost) {
          const { error: updateRoomErr } = await supabase
            .from('room')
            .update({ host_id: newPlayer.id })
            .eq('id', room.id);

          if (updateRoomErr) {
            console.error('更新房间创建者失败:', updateRoomErr);
          }
        }

        setPlayer(newPlayer);
        setPlayers(players ? [...players, newPlayer] : [newPlayer]);

        // 發送系統消息：玩家創建了房間
        try {
          await supabase.from('message').insert([{
            room_id: room.id,
            sender_id: null, // 改為 null 代表系統
            receiver_id: null,
            content: `${newPlayer.name} 創建了房間`,
          }]);
        } catch (messageError) {
          console.error('發送系統消息失敗:', messageError);
          // 不中斷流程，繼續執行
        }

        toast.success('房間創建成功！');
        router.push(`/room/${code}`);
      } catch (insertError) {
        console.error('創建玩家時發生異常:', insertError);
        setError('創建玩家時發生異常: ' + (insertError instanceof Error ? insertError.message : '未知錯誤'));
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('創建房間時發生錯誤：', error);
      toast.error('創建房間時發生錯誤：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setCreating(false);
    }
  }

  // 加入房間
  async function joinRoom() {
    if (!joinCode) {
      toast.error('請輸入房間代碼');
      alert('請輸入房間代碼');
      return;
    }

    if (!userCode) {
      toast.error('無法獲取用戶信息');
      return;
    }

    setJoining(true);
    try {
      const code = joinCode.toUpperCase();
      const { data: room, error: roomErr } = await supabase
        .from('room')
        .select('*')
        .eq('room_code', parseInt(code, 10))
        .single();

      if (roomErr || !room) {
        toast.error('房間不存在，請重新輸入');
        alert('查無此房間代碼，請確認後重新輸入');
        setJoinCode('');
        return;
      }

      if (roomErr || room.status != 'waiting' && room.status != 'introduction') {
        toast.error('此房間已開始遊戲，請尋找其他房間');
        alert('此房間已開始遊戲，請尋找其他房間');
        setJoinCode('');
        return;
      }

      // 檢查房間是否已滿
      const { count: playerCount } = await supabase
        .from('player')
        .select('*', { count: 'exact' })
        .eq('room_id', room.id);

      if (playerCount && playerCount >= MAX_PLAYER) {
        toast.error('房間已滿');
        return;
      }

      // 創建玩家
      const { data: player, error: playerErr } = await supabase
        .from('player')
        .insert([{
          room_id: room.id,
          name: name || userCode,
          is_host: false,
          role_id: null
        }])
        .select('id, room_id, name, is_host, role_id')
        .single();

      if (playerErr || !player) {
        toast.error('加入房間失敗：' + (playerErr?.message || '未知錯誤'));
        return;
      }

      // 發送系統消息：玩家加入了房間
      try {
        await supabase.from('message').insert([{
          room_id: room.id,
          sender_id: null, // 改為 null 代表系統
          receiver_id: null,
          content: `${player.name} 加入了房間`,
        }]);
      } catch (messageError) {
        console.error('發送系統消息失敗:', messageError);
        // 不中斷流程，繼續執行
      }

      // 保存玩家ID和暱稱到localStorage
      localStorage.setItem(`player_id_${code}`, player.id);
      localStorage.setItem(`player_created_${code}`, 'true');
      if (name) {
        localStorage.setItem('user_name', name);
      }

      toast.success('成功加入房間！');
      router.push(`/room/${code}`);
    } catch (error) {
      console.error('加入房間時發生錯誤：', error);
      toast.error('加入房間失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-6 bg-white rounded-xl shadow-md border border-gray-200">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-indigo-700">AI劇本殺遊戲</h1>
        <p className="text-gray-500">預設暱稱：<span className="font-medium text-gray-700">{userCode}</span></p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">自訂暱稱（可選）</label>
        <input
          type="text"
          placeholder="輸入暱稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      <button
        disabled={creating}
        onClick={createRoom}
        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
      >
        {creating ? '創建中...' : '創立新房間'}
      </button>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">加入房間</label>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="輸入房間代碼"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="flex-grow border border-gray-300 rounded-lg px-3 py-2 uppercase tracking-widest focus:ring-2 focus:ring-green-300"
            maxLength={6}
          />
          <button
            disabled={joining}
            onClick={joinRoom}
            className="px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {joining ? '加入中...' : '加入房間'}
          </button>
        </div>
      </div>
    </main>

  );
}