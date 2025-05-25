'use client';
import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

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
  palayerId: string;
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
                .from('messages')
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

  const handleDiscoverClue = async (clue: string) => {
    if (!discoveredClues.includes(clue)) {
      setDiscoveredClues([...discoveredClues, clue]);
      
      // 將發現的線索記錄到數據庫
      await supabase.from('discovered_clues').insert([
        {
          room_id: roomId,
          player_id: playerId,
          clue: clue,
        },
      ]);
    }
  };

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
                <h4 className="font-semibold">{location.location}</h4>
                <ul className="list-disc pl-5">
                  {location.objects.map((object, objIndex) => (
                    <li
                      key={objIndex}
                      className="cursor-pointer hover:underline"
                      onClick={() => handleDiscoverClue(object.clue)}
                    >
                      {object.name} - {discoveredClues.includes(object.clue) ? object.clue : '未調查'}
                    </li>
                  ))}
                </ul>
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
