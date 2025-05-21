'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ChatRoom from '@/components/ChatRoom';

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
    const existing = localStorage.getItem('user_code');
    if (existing) {
      setUserCode(existing);
    } else {
      const newCode = generateUserCode();
      localStorage.setItem('user_code', newCode);
      setUserCode(newCode);
    }
  }, []);

  // 創建房間，並建立房主玩家
  async function createRoom() {
    setCreating(true);
    try {
      const code = generateRoomCode();
      const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert([{ code, status: 'waiting', max_players: 6 }])
      .select()
      .single();


      if (roomErr || !room) {
        alert('建立房間失敗：' + roomErr?.message);
        return;
      }

      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert([{
          room_id: room.id,
          nickname: nickname || userCode,
          is_host: true,
          joined_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (playerErr || !player) {
        alert('建立玩家失敗：' + playerErr?.message);
        return;
      }

      router.push(`/room/${code}`);
    } finally {
      setCreating(false);
    }
  }

  // 加入房間
  async function joinRoom() {
    if (!joinCode) return;
    setJoining(true);
    try {
      const code = joinCode.toUpperCase();
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single();

      if (error || !room) {
        alert('房間不存在，請重新輸入');
        setJoinCode('');
        setJoining(false);
        return;
      }

      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert([{
          room_id: room.id,
          nickname: nickname || userCode,
          is_host: false,
          joined_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (playerErr || !player) {
        alert('加入房間時建立玩家失敗：' + playerErr?.message);
        return;
      }

      router.push(`/room/${code}`);
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