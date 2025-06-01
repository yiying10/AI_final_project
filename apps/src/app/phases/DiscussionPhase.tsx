'use client';

import React, { useEffect, useState } from 'react';
import { useSyncedTimer } from '../lib/useSyncedTimer';

interface DiscussionPhaseProps {
  roomId: string;
  currentPhase: string;
  isHost: boolean;
  setCurrentPhase: () => void;
}

export default function DiscussionPhase({
  roomId,
  currentPhase,
  setCurrentPhase,
  isHost
}: DiscussionPhaseProps) {
  
  const timer = useSyncedTimer({
    roomId,
    phase: currentPhase,
    isHost,
    duration: 300, //TODO: 300 
    onTimerEnd: () => setCurrentPhase(), // 房主結束時切換
  });

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
