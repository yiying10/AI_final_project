'use client';
import React, { useState, useEffect } from 'react';
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
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ name: string; clue: string } | null>(null);

  useEffect(() => {
    setTimer(30); // 初始倒數時間

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          (async () => {
            setCurrentPhase('discussion');
            const { error: messageError } = await supabase.from('message').insert([
              {
                room_id: roomId,
                sender_id: SYSTEM_USER_ID,
                receiver_id: null,
                content: '蒐證階段結束，現在是討論時間',
              },
            ]);
            if (messageError) console.error('發送系統訊息失敗:', messageError);
          })();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [roomId]);

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      <div className="mb-4 text-right text-lg font-bold text-red-600">
        倒計時：{timer} 秒
      </div>

      {activeTab === 'map' && (
        <div>
          <h3 className="text-xl font-bold mb-3">地圖</h3>

          {/* 沒有選擇地點時，顯示所有地點 */}
          {!selectedLocation && (
            <div className="grid grid-cols-2 gap-4">
              {gameContent.map((loc, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedLocation(loc.location)}
                  className="p-4 bg-indigo-100 rounded hover:bg-indigo-200 cursor-pointer"
                >
                  {loc.location}
                </div>
              ))}
            </div>
          )}

          {/* 選擇地點後，顯示此地點內的物件 */}
          {selectedLocation && !selectedItem && (
            <div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="text-sm text-blue-600 underline mb-2"
              >
                返回地圖
              </button>
              <h4 className="text-lg font-bold mb-2">{selectedLocation} 內的物件與 NPC</h4>
              <div className="grid grid-cols-2 gap-4">
                {gameContent
                  .find((loc) => loc.location === selectedLocation)
                  ?.objects.map((obj, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedItem(obj)}
                      className="p-4 bg-green-100 rounded hover:bg-green-200 cursor-pointer"
                    >
                      {obj.name}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 顯示物件/角色的詳細內容 */}
          {selectedItem && (
            <div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-sm text-blue-600 underline mb-2"
              >
                返回 {selectedLocation}
              </button>
              <h4 className="text-lg font-bold mb-2">{selectedItem.name} 的線索</h4>
              <p className="bg-white p-2 rounded border">{selectedItem.clue || '無更多資訊'}</p>
            </div>
          )}
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
