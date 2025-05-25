'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Player {
  id: string;
  role: string;
}

interface Props {
  playerId: string;
  roomId: string;
  setCurrentPhase: (phase: string) => void;
}

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

const VotingPhase = ({ playerId, roomId, setCurrentPhase }: Props) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [votes, setVotes] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, role')
        .eq('room_id', roomId);

      if (!error && data) setPlayers(data);
      else console.error('獲取玩家列表失敗:', error);
    };

    fetchPlayers();
  }, [roomId]);

  const handleVote = async (targetId: string | null) => {
    const { error } = await supabase
      .from('votes')
      .insert([{ room_id: roomId, voter_id: playerId, target_id: targetId }]);

    if (error) {
      console.error('投票失敗:', error);
      return;
    }

    setVotes((prev) => ({ ...prev, [playerId]: targetId }));

    // 檢查是否所有人已投票
    const { data: allVotes, error: fetchError } = await supabase
      .from('votes')
      .select('voter_id')
      .eq('room_id', roomId);

    if (fetchError) {
      console.error('檢查投票狀態失敗:', fetchError);
      return;
    }

    if (allVotes.length === players.length) {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: 'ended' })
        .eq('id', roomId);

      if (!updateError) {
        setCurrentPhase('ended');
        const { error: messageError } = await supabase.from('messages').insert([
          {
            room_id: roomId,
            sender_id: SYSTEM_USER_ID,
            receiver_id: null,
            content: '投票結束，遊戲已結束。',
          },
        ]);
        if (messageError) console.error('發送系統訊息失敗:', messageError);
      } else {
        console.error('更新房間狀態失敗:', updateError);
      }
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      <h3 className="text-xl font-bold mb-3">投票階段</h3>
      <p className="mb-4">根據討論結果，投票選出你認為的兇手。</p>
      <ul className="mb-4">
        {players.map((player) => (
          <li key={player.id} className="mb-2">
            <button
              onClick={() => handleVote(player.id)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={!!votes[playerId]}
            >
              投票給 {player.role}
            </button>
          </li>
        ))}
        <li>
          <button
            onClick={() => handleVote(null)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            disabled={!!votes[playerId]}
          >
            棄票
          </button>
        </li>
      </ul>
      {votes[playerId] && <p className="text-green-600">你已完成投票。</p>}
    </div>
  );
};

export default VotingPhase;
