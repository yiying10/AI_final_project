import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Player {
  id: string;
  nickname: string;
  role: string;
}

interface Evidence {
  id: string;
  name: string;
  description: string;
  found: boolean;
}

interface DiscussionProps {
  roomId: string;
  playerId: string;
  players: Player[];
  evidence: Evidence[];
  onVote: (suspectId: string) => void;
}

export default function Discussion({
  roomId,
  playerId,
  players: initialPlayers,
  evidence,
  onVote,
}: DiscussionProps) {
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  // 訂閱玩家列表變化
  useEffect(() => {
    const playerChannel = supabase
      .channel(`room-${roomId}-players`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        async () => {
          // 重新獲取玩家列表
          const { data: updatedPlayers } = await supabase
            .from('players')
            .select('id, nickname, role')
            .eq('room_id', roomId);
          
          if (updatedPlayers) {
            setPlayers(updatedPlayers);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playerChannel);
    };
  }, [roomId]);

  async function handleVote() {
    if (!selectedSuspect || voted) return;

    await supabase.from('votes').insert([
      {
        room_id: roomId,
        voter_id: playerId,
        suspect_id: selectedSuspect,
      },
    ]);

    setVoted(true);
    onVote(selectedSuspect);

    // 發送系統訊息
    await supabase.from('messages').insert([
      {
        room_id: roomId,
        sender_id: 'system',
        receiver_id: 'system',
        content: `有人投了票！`,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      {/* 證物列表 */}
      <div className="p-4 border rounded bg-white">
        <h3 className="text-lg font-semibold mb-2">已發現的證物</h3>
        <div className="grid grid-cols-2 gap-2">
          {evidence.map((item) => (
            <div key={item.id} className="p-2 border rounded">
              <h4 className="font-medium">{item.name}</h4>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 投票區域 */}
      {!voted && (
        <div className="p-4 border rounded bg-white">
          <h3 className="text-lg font-semibold mb-2">投票</h3>
          <div className="grid grid-cols-2 gap-4">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedSuspect(p.id)}
                className={`p-4 border rounded ${
                  selectedSuspect === p.id
                    ? 'bg-blue-100 border-blue-500'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <h4 className="font-medium">{p.nickname}</h4>
                <p className="text-sm text-gray-600">{p.role}</p>
              </button>
            ))}
          </div>
          <button
            onClick={handleVote}
            disabled={!selectedSuspect}
            className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            確認投票
          </button>
        </div>
      )}
    </div>
  );
} 