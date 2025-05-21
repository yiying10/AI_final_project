'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ChatRoom from '@/components/ChatRoom';

export default function RoomPage() {
  const params = useParams();
  const codeParam = params.code as string;

  const [room, setRoom] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!codeParam) return;

    async function fetchRoomAndPlayer() {
      setLoading(true);

      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', codeParam)
        .single();

      if (roomErr || !room) {
        setError('找不到該房間');
        setLoading(false);
        return;
      }

      setRoom(room);

      const userCode = localStorage.getItem('user_code');
      const { data: player, error: playerErr } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)
        .eq('nickname', userCode)
        .single();

      if (playerErr || !player) {
        setError('找不到對應的玩家');
        setPlayer(null);
      } else {
        setPlayer(player);
        setError('');
      }

      setLoading(false);
    }

    fetchRoomAndPlayer();
  }, [codeParam]);

  if (loading) return <p className="p-6 text-center">載入中...</p>;
  if (error) return <p className="p-6 text-center text-red-600">{error}</p>;
  if (!room || !player) return null;

  return (
    <main className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-1">房間代碼：{room.code}</h2>
      <p className="text-gray-600 text-sm mb-4">你的名稱：{player.nickname}</p>
      <p>狀態：{room.status}</p>
      <p>
        人數：{/* 動態撈 players 數量 */}
        <PlayerCount roomId={room.id} /> / {room.max_players}
      </p>

      <div className="mt-6 border rounded bg-white shadow">
        <ChatRoom roomId={room.id} player={player} />
      </div>
    </main>
  );
}

function PlayerCount({ roomId }: { roomId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      const { data } = await supabase.from('players').select('id').eq('room_id', roomId);
      if (data) setCount(data.length);
    }
    fetchCount();
  }, [roomId]);

  return <>{count}</>;
}
