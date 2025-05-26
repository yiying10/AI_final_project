'use client';
import React, { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SYSTEM_USER_ID } from '../lib/config';
interface InvestigationPhaseProps {
  activeTab: 'map' | 'chat';
  setActiveTab: React.Dispatch<React.SetStateAction<'map' | 'chat'>>;
  timer: number;
  discoveredClues: string[];
  setDiscoveredClues: React.Dispatch<React.SetStateAction<string[]>>;
  gameContent: {
    location: string;
    objects: { name: string; clue: string }[];
  }[];
  roomId: string;
  playerId: string;
  setCurrentPhase: React.Dispatch<React.SetStateAction<string>>;
  setTimer: React.Dispatch<React.SetStateAction<number>>;
}

const InvestigationPhase: React.FC<InvestigationPhaseProps> = ({
  activeTab,
  setActiveTab,
  timer,
  discoveredClues,
  setDiscoveredClues,
  gameContent,
  roomId,
  playerId,
  setCurrentPhase,
  setTimer,
}) => {

  useEffect(() => {
    setTimer(10); // 初始倒數時間

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          // 切到 discussion 階段
          (async () => {
              setCurrentPhase('investigation');
              const { error: messageError } = await supabase
                .from('message')
                .insert([
                  {
                    room_id: roomId,
                    sender_id: SYSTEM_USER_ID,
                    receiver_id: null,
                    content: '蒐證階段結束，現在是討論時間',
                  },
                ]);

              if (messageError) {
                console.error('發送系統訊息失敗:', messageError);
              }
            }
          )();

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [roomId]);

  return (
      <div className="bg-gray-50 p-4 rounded-lg border">
        {/* 顯示計時器 */}
        <div className="mb-4 text-right text-lg font-bold text-red-600">
          倒計時：{timer} 秒
        </div>

        {activeTab === 'map' && (
          <div>
            <h3 className="text-xl font-bold mb-3">地圖</h3>
            {gameContent.map((location, index) => (
              <div key={index} className="mb-4">

              </div>
            ))}
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            <h3 className="text-xl font-bold mb-3">聊天室</h3>
            <p>此處可以顯示聊天室內容。</p>
          </div>
        )}
      </div>
  );
};

export default InvestigationPhase;
