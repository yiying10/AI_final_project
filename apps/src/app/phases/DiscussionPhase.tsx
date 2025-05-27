'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface DiscussionPhaseProps {
  roomId: string;
  currentPhase: string;
  setCurrentPhase: () => void;
}

export default function DiscussionPhase({
  roomId,
  currentPhase,
  setCurrentPhase,
}: DiscussionPhaseProps) {
  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const [timer, setTimer] = useState<number>(10); // 初始倒計時為10秒
  useEffect(() => {
    if ((currentPhase === 'discussion1' || currentPhase === 'discussion2') && !isTimerStarted) {
      setIsTimerStarted(true);

      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCurrentPhase();

            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentPhase, isTimerStarted, roomId, setTimer, setCurrentPhase]);

  // reset 計時器狀態當 phase 改變時
  useEffect(() => {
    setIsTimerStarted(false);
  }, [currentPhase]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-indigo-700 font-semibold text-xl">
          {currentPhase === 'discussion1' && '第一階段討論'}
          {currentPhase === 'discussion2' && '第二階段討論'}
        </div>
        <div className="bg-red-100 text-red-700 font-bold px-4 py-1 rounded-full shadow-sm">
          倒計時：{timer} 秒
        </div>
      </div>
  
      <hr className="border-gray-300" />
  
      <p className="text-gray-700 leading-relaxed">
        請與其他玩家討論案件，分享你的角色視角與線索，嘗試推敲出誰是真正的兇手。
      </p>
    </div>
  );
  
}
