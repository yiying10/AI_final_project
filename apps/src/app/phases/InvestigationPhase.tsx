'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { chatWithNPC } from '../lib/chatWithNPC';

interface InvestigationPhaseProps {
  roomId: string;
  roomCode: number;
  playerId: string;
  currentPhase: string;
  setCurrentPhase: () => void;
}

const InvestigationPhase: React.FC<InvestigationPhaseProps> = ({
  roomId,
  roomCode,
  playerId,
  currentPhase,
  setCurrentPhase,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{ type: 'object' | 'npc'; name: string; content?: string | null; ref?: string | null } | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [objects, setObjects] = useState<{ id: string; map_id: string; name: string; content: string | null }[]>([]);
  const [npcs, setNpcs] = useState<{ id: string; map_id: string; name: string; ref: string | null }[]>([]);
  const [chatDialogue, setChatDialogue] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [timer, setTimer] = useState<number>(10);

  // 倒數計時器
  useEffect(() => {
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
  }, [roomId]);

  // 取得資料
  useEffect(() => {
    async function fetchData() {
      const { data: roomData, error: roomError } = await supabase.from('room').select('script_id').eq('id', roomId).single();
      if (roomError || !roomData?.script_id) {
        console.error('取得房間 script_id 失敗:', roomError);
        return;
      }
      const scriptId = roomData.script_id;

      const { data: locs } = await supabase.from('gamemap').select('id, name').eq('script_id', scriptId);
      const { data: objs } = await supabase.from('gameobject').select('id, map_id, name, content').eq('script_id', scriptId);
      const { data: npcs } = await supabase.from('gamenpc').select('id, map_id, name, ref').eq('script_id', scriptId);

      setLocations(locs || []);
      setObjects(objs || []);
      setNpcs(npcs || []);
    }
    fetchData();
  }, [roomId]);

  const handleTalk = async (npcId: string) => {
    try {
      const response = await chatWithNPC(roomCode, playerId, npcId, {
        text: 'inputText',
      });

      console.log('NPC 對話:', response.dialogue);
      setChatDialogue(response.dialogue || 'NPC 沒有回應');
      if (response.hint) console.log('NPC 線索:', response.hint);
      if (response.evidence) console.log('NPC 提供證據:', response.evidence);
    } catch (err) {
      console.error('對話失敗:', err);
      setChatDialogue('對話失敗，請稍後再試');
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      <div className="mb-4 text-right text-lg font-bold text-red-600">倒計時：{timer} 秒</div>
      <div>
        <h3 className="text-xl font-bold mb-3">地圖</h3>

        {!selectedLocation && (
          <div className="grid grid-cols-2 gap-4">
            {locations.map((loc) => (
              <div
                key={loc.id}
                onClick={() => setSelectedLocation(loc.id)}
                className="p-4 bg-indigo-100 rounded hover:bg-indigo-200 cursor-pointer"
              >
                {loc.name}
              </div>
            ))}
          </div>
        )}

        {selectedLocation !== null && !selectedDetail && (
          <div>
            <button onClick={() => setSelectedLocation(null)} className="text-sm text-blue-600 underline mb-2">返回地圖</button>
            <h4 className="text-lg font-bold mb-2">{locations.find((l) => l.id === selectedLocation)?.name}</h4>

            <div className="grid grid-cols-2 gap-4">
              {objects.filter((o) => o.map_id === selectedLocation).map((obj) => (
                <div
                  key={`obj-${obj.id}`}
                  onClick={() => setSelectedDetail({ type: 'object', name: obj.name, content: obj.content })}
                  className="p-4 bg-green-100 rounded hover:bg-green-200 cursor-pointer"
                >
                  {obj.name}
                </div>
              ))}
              {npcs.filter((n) => n.map_id === selectedLocation).map((npc) => (
                <div
                  key={`npc-${npc.id}`}
                  onClick={() => setSelectedDetail({ type: 'npc', name: npc.name, ref: npc.ref })}
                  className="p-4 bg-yellow-100 rounded hover:bg-yellow-200 cursor-pointer"
                >
                  {npc.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedDetail && (
          <div>
            <button onClick={() => setSelectedDetail(null)} className="text-sm text-blue-600 underline mb-2">
              返回 {locations.find((l) => l.id === selectedLocation)?.name}
            </button>
            <h4 className="text-lg font-bold mb-2">{selectedDetail.name} 的內容</h4>
            <p className="bg-white p-2 rounded border">
              {selectedDetail.type === 'object' ? selectedDetail.content || '無更多資訊' : selectedDetail.ref || '這是 NPC，你可以開始互動！'}
            </p>
            {selectedDetail.type === 'npc' && (
              <button
                onClick={() => handleTalk(npcs.find((n) => n.name === selectedDetail.name)?.id || '')}
                className="mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                與 {selectedDetail.name} 對話
              </button>
            )}
          </div>
        )}

        {chatDialogue && (
          <div className="mt-4 p-4 bg-gray-100 rounded border">
            <h4 className="text-lg font-bold mb-2">NPC 對話</h4>
            <p>{chatDialogue}</p>
            <button onClick={() => setChatDialogue(null)} className="mt-2 text-sm text-blue-600 underline">
              關閉對話
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestigationPhase;
