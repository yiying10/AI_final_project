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
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-4">
      <h3 className="text-2xl font-bold text-indigo-700">投票階段</h3>
      <p className="text-gray-700">根據討論結果，投票選出你認為的兇手。</p>
  
      <ul className="space-y-2">
        {players.map((player) => (
          <li key={player.id}>
            <button
              onClick={() => handleVote(player.id)}
              className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              disabled={!!votes[playerId]}
            >
              投票給 {roleMap[player.role_id] || '未知角色'}
            </button>
          </li>
        ))}
        <li>
          <button
            onClick={() => handleVote(null)}
            className="w-full py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
            disabled={!!votes[playerId]}
          >
            棄票
          </button>
        </li>
      </ul>
  
      {votes[playerId] && (
        <p className="text-green-600 font-semibold text-center">你已完成投票</p>
      )}
    </div>
  );   
};

export default VotingPhase;
