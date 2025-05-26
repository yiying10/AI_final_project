'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SYSTEM_USER_ID } from '../lib/config';

interface DiscussionPhaseProps {
  roomId: string;
  timer: number;
  setTimer: React.Dispatch<React.SetStateAction<number>>;
  setCurrentPhase: (phase: string) => void;
}

export default function DiscussionPhase({
  roomId,
  timer,
  setTimer,
  setCurrentPhase,
}: DiscussionPhaseProps) {
  const [isTimerInitialized, setIsTimerInitialized] = useState(false); // 新增狀態追蹤計時器是否已初始化
  
  // 初始化計時器，只在組件首次渲染時執行
  useEffect(() => {
    if (!isTimerInitialized) {
      setTimer(30);
      setIsTimerInitialized(true); // 標記計時器已初始化
    }
  }, [isTimerInitialized, setTimer]);

  // 倒計時邏輯
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          // 切換到投票階段
          (async () => {
            const { error: messageError } = await supabase
              .from('messages')
              .insert([
                {
                  room_id: roomId,
                  sender_id: SYSTEM_USER_ID,
                  receiver_id: null,
                  content: '討論階段結束，現在是投票時間',
                },
              ]);

            if (messageError) {
              console.error('發送系統訊息失敗:', messageError);
            }
            setCurrentPhase('discussion');

          })();

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval); // 清除計時器
  }, [timer, roomId, setTimer, setCurrentPhase]);

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-bold">討論階段</h3>
        <span className="text-lg font-bold text-red-600">倒計時：{timer} 秒</span>
      </div>
      <p>與其他玩家討論案件，分享線索，找出兇手。</p>
    </div>
  );
}