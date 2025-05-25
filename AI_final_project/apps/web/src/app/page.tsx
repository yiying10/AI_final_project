'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

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
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

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
        .from('rooms')
        .insert([{ 
          code, 
          status: 'waiting',
          max_players: 6,
          created_at: new Date().toISOString()
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

      // 查看 players 表结构，仅使用必要字段
      console.log('準備創建玩家，房間ID:', room.id, '暱稱:', nickname || userCode);
      
      let createdPlayer;
      try {
        const { data: player, error: playerErr } = await supabase
          .from('players')
          .insert([{
            room_id: room.id,
            nickname: nickname || userCode,
            is_host: true,
            role: null,
            joined_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (playerErr) {
          console.error('創建玩家失敗，錯誤詳情:', playerErr);
          toast.error('建立玩家失敗：' + playerErr.message);
          
          // 清理：如果創建玩家失敗，刪除已創建的房間
          await supabase
            .from('rooms')
            .delete()
            .eq('id', room.id);
            
          return;
        }

        if (!player) {
          console.error('創建玩家失敗：未返回玩家數據');
          toast.error('建立玩家失敗：未返回玩家數據');
          
          // 清理：如果創建玩家失敗，刪除已創建的房間
          await supabase
            .from('rooms')
            .delete()
            .eq('id', room.id);
            
          return;
        }
        
        createdPlayer = player;

        // 檢查玩家是否真的被創建
        const { data: checkPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('id', player.id)
          .single();
          
        if (checkPlayer) {
          console.log('確認玩家已成功創建:', checkPlayer);
        } else {
          console.warn('警告：無法確認玩家是否成功創建');
        }

        // 發送系統消息：玩家創建了房間
        try {
          await supabase.from('messages').insert([{
            room_id: room.id,
            sender_id: player.id,
            receiver_id: null,
            content: `${player.nickname} 創建了房間`,
          }]);
        } catch (messageError) {
          console.error('發送系統消息失敗:', messageError);
          // 不中斷流程，繼續執行
        }

        console.log('玩家創建成功：', player);
        
        // 保存玩家ID和暱稱到localStorage
        localStorage.setItem(`player_id_${code}`, player.id);
        localStorage.setItem(`player_created_${code}`, 'true');
        if (nickname) {
          localStorage.setItem('user_nickname', nickname);
        }
      } catch (createPlayerError) {
        console.error('創建玩家時發生異常:', createPlayerError);
        toast.error('創建玩家時發生異常: ' + (createPlayerError instanceof Error ? createPlayerError.message : '未知錯誤'));
        
        // 清理：如果創建玩家失敗，刪除已創建的房間
        await supabase
          .from('rooms')
          .delete()
          .eq('id', room.id);
          
        return;
      }
      
      toast.success('房間創建成功！');
      router.push(`/room/${code}`);
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
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single();

      if (roomErr || !room) {
        toast.error('房間不存在，請重新輸入');
        setJoinCode('');
        return;
      }

      // 檢查房間是否已滿
      const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact' })
        .eq('room_id', room.id);

      if (playerCount && playerCount >= room.max_players) {
        toast.error('房間已滿');
        return;
      }

      // 創建玩家
      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert([{
          room_id: room.id,
          nickname: nickname || userCode,
          is_host: false,
          role: null,
          joined_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (playerErr || !player) {
        toast.error('加入房間失敗：' + (playerErr?.message || '未知錯誤'));
        return;
      }

      // 發送系統消息：玩家加入了房間
      try {
        await supabase.from('messages').insert([{
          room_id: room.id,
          sender_id: player.id,
          receiver_id: null,
          content: `${player.nickname} 加入了房間`,
        }]);
      } catch (messageError) {
        console.error('發送系統消息失敗:', messageError);
        // 不中斷流程，繼續執行
      }

      // 保存玩家ID和暱稱到localStorage
      localStorage.setItem(`player_id_${code}`, player.id);
      localStorage.setItem(`player_created_${code}`, 'true');
      if (nickname) {
        localStorage.setItem('user_nickname', nickname);
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
    <main className="max-w-md mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-center">劇本殺遊戲</h1>
      <p className="text-center text-gray-500">預設暱稱：{userCode}</p>

      <input
        type="text"
        placeholder="輸入暱稱（可選）"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2"
      />

      {/* 創房按鈕 */}
      <button
        disabled={creating}
        onClick={createRoom}
        className="w-full py-3 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {creating ? '創建中...' : '創立新房間'}
      </button>

      {/* 加入房間輸入 */}
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="輸入房間代碼"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          className="flex-grow border border-gray-300 rounded px-3 py-2 uppercase tracking-widest"
          maxLength={6}
        />
        <button
          disabled={joining}
          onClick={joinRoom}
          className="px-4 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {joining ? '加入中...' : '加入房間'}
        </button>
      </div>
    </main>
  );
}