'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Player {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  role_id: string;
}

interface Gamerole {
  id: string;
  script_id: string;
  name: string;
  public_info: string;
  secret: string;
  mission: string;
  dialogue1: string;
  dialogue2: string;
}

interface Props {
  playerId: string;
  roomId: string;
  setCurrentPhase: () => void;
}

const VotingPhase = ({ playerId, roomId, setCurrentPhase }: Props) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [votes, setVotes] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const fetchData = async () => {
      const { data: playerData, error: playerError } = await supabase
        .from('player')
        .select('id, room_id, name, is_host, role_id')
        .eq('room_id', roomId);

      if (playerError || !playerData) {
        console.error('獲取玩家列表失敗:', playerError);
        return;
      }

      setPlayers(playerData);

      const { data: roleData, error: roleError } = await supabase
        .from('gamerole')
        .select('id, name');

      if (roleError || !roleData) {
        console.error('獲取角色名稱失敗:', roleError);
        return;
      }

      const roleMapObj: Record<string, string> = {};
      roleData.forEach((role) => {
        roleMapObj[role.id] = role.name;
      });

      setRoleMap(roleMapObj);
    };

    fetchData();
  }, [roomId]);

  const handleVote = async (targetId: string | null) => {
    const { error } = await supabase
      .from('vote')
      .insert([{ room_id: roomId, voter_id: playerId, target_id: targetId }]);

    if (error) {
      console.error('投票失敗:', error);
      return;
    }

    setVotes((prev) => ({ ...prev, [playerId]: targetId }));

    const { data: allVotes, error: fetchError } = await supabase
      .from('vote')
      .select('voter_id')
      .eq('room_id', roomId);

    if (fetchError) {
      console.error('檢查投票狀態失敗:', fetchError);
      return;
    }

    if (allVotes.length === players.length) {
      const { error: updateError } = await supabase
        .from('room')
        .update({ status: 'ended' })
        .eq('id', roomId);

      if (!updateError) {
        setCurrentPhase();
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
              投票給 {roleMap[player.role_id] || '未知角色'}
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
