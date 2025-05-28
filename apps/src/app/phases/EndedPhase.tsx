'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface EndedPhaseProps {
  roomId: string;
}

export default function EndedPhase({ roomId }: EndedPhaseProps) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [mostVotedPlayer, setMostVotedPlayer] = useState<string | null>(null);
  const [playerMap, setPlayerMap] = useState<Record<string, string>>({}); // player.id -> player.name

  useEffect(() => {
    const fetchData = async () => {
      const { data: roomData, error: roomError } = await supabase
        .from('room')
        .select('script_id')
        .eq('id', roomId)
        .single();

      if (roomError || !roomData?.script_id) {
        console.error('讀取 room 資料失敗:', roomError);
        return;
      }

      const { data: scriptData, error: scriptError } = await supabase
        .from('gamescript')
        .select('answer')
        .eq('id', roomData.script_id)
        .single();

      if (scriptError) {
        console.error('讀取 script answer 失敗:', scriptError);
        return;
      }

      setAnswer(scriptData?.answer || '未設定解答');

      const { data: votes, error: votesError } = await supabase
        .from('vote')
        .select('voter_id, voter_id')
        .eq('room_id', roomId);

      if (votesError) {
        console.error('讀取投票資料失敗:', votesError);
        return;
      }

      const countMap: Record<string, number> = {};
      votes.forEach((vote) => {
        if (vote.voter_id) {
          countMap[vote.voter_id] = (countMap[vote.voter_id] || 0) + 1;
        }
      });
      setVoteCounts(countMap);

      let maxVotes = 0;
      let topPlayerId = null;
      for (const [playerId, count] of Object.entries(countMap)) {
        if (count > maxVotes) {
          maxVotes = count;
          topPlayerId = playerId;
        }
      }
      setMostVotedPlayer(topPlayerId);

      // 4️⃣ 取得玩家名稱映射
      const { data: players, error: playersError } = await supabase
        .from('player')
        .select('id, name')
        .eq('room_id', roomId);

      if (playersError) {
        console.error('讀取玩家資料失敗:', playersError);
        return;
      }

      const map: Record<string, string> = {};
      players.forEach((p) => (map[p.id] = p.name));
      setPlayerMap(map);
    };

    fetchData();
  }, [roomId]);

  return (
    <div className="bg-white px-4 py-4 rounded-xl shadow-md border border-gray-200 space-y-4">
      <h2 className="text-xl font-bold text-indigo-700">投票結果</h2>
      <div className="space-y-1 text-gray-700">
        {Object.entries(voteCounts).map(([playerId, count]) => (
          <p key={playerId}>
            {playerMap[playerId]}：<span className="font-semibold">{count} 票</span>
          </p>
        ))}
      </div>
      {mostVotedPlayer ? (
        <p className="text-gray-800">
          大家認為的兇手是：<span className="font-bold text-red-600">{playerMap[mostVotedPlayer]}</span>！
        </p>
      ) : (
        <p className="text-gray-600">無投票結果。</p>
      )}

      <h2 className="text-xl font-bold text-indigo-700">還原真相</h2>
      <p className="text-gray-800">{answer || '載入中...'}</p>

      <hr className="border-gray-300" />

      <h2 className="text-xl font-bold text-indigo-700">遊戲結束</h2>
      <p className="text-gray-700">感謝您的參與！</p>
    </div>
  );
}
