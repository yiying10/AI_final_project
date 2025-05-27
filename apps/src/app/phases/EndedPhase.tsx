'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface EndedPhaseProps {
  roomId: string;
}

export default function EndedPhase({ roomId }: EndedPhaseProps) {
  const [answer, setAnswer] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnswer = async () => {
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
    };

    fetchAnswer();
  }, [roomId]);

  return (
    <div className="bg-gray-100 px-3 py-2 rounded mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2>還原真相</h2>
        <p>{answer || '載入中...'}</p>
      </div>
      <div>
        <h2>遊戲結束</h2>
        <p>感謝您的參與！</p>
      </div>
    </div>
  );
}
