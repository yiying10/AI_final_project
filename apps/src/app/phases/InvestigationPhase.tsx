'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { chatWithNPC } from '../lib/chatWithNPC';
import { useSyncedTimer } from '../lib/useSyncedTimer';

interface InvestigationPhaseProps {
  roomId: string;
  roomCode: number;
  playerId: string;
  currentPhase: string;
  isHost: boolean;
  setCurrentPhase: () => void;
}

const InvestigationPhase: React.FC<InvestigationPhaseProps> = ({
  roomId,
  roomCode,
  isHost,
  playerId,
  currentPhase,
  setCurrentPhase,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{ type: 'object' | 'npc'; name: string; content?: string | null; ref?: string | null } | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [objects, setObjects] = useState<{ id: string; map_id: string; name: string; content: string | null }[]>([]);
  const [npcs, setNpcs] = useState<{ id: string; map_id: string; name: string; ref: string | null }[]>([]);
  const [chatDialogues, setChatDialogues] = useState<{ [npcId: string]: string }>({});
  const [inputText, setInputText] = useState<string>('');

  const timer = useSyncedTimer({
    roomId,
    phase: currentPhase,
    isHost,
    duration: 90, //TODO: 210秒
    onTimerEnd: () => setCurrentPhase(), // 房主結束時切換
  });

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
      // 獲取遊戲資料
      const { data: roomData, error: roomError } = await supabase
        .from('room')
        .select('script_id')
        .eq('id', roomId)
        .single();
  
      if (roomError || !roomData?.script_id) {
        console.error('無法獲取遊戲 ID:', roomError);
        setChatDialogues((prev) => ({
          ...prev,
          [npcId]: '系統錯誤，無法獲取遊戲資訊'
        }));
        return;
      }
  
      // 獲取遊戲背景
      const { data: scriptData, error: scriptError } = await supabase
        .from('script')
        .select('background')
        .eq('id', roomData.script_id)
        .single();
  
      // 獲取玩家角色資訊
      const { data: playerData, error: playerError } = await supabase
        .from('player')
        .select('character_id')
        .eq('id', playerId)
        .single();
  
      let playerCharacter = null;
      if (playerData?.character_id) {
        const { data: characterData, error: characterError } = await supabase
          .from('character')
          .select('name, role, public_info, secret, mission')
          .eq('id', playerData.character_id)
          .single();
  
        if (!characterError && characterData) {
          playerCharacter = characterData;
        }
      }
  
      console.log('獲取的玩家角色資訊:', playerCharacter);
  
      // 獲取 NPC 詳細資訊
      const npc = npcs.find(n => n.id === npcId);
      if (!npc) {
        setChatDialogues((prev) => ({
          ...prev,
          [npcId]: '找不到 NPC 資訊'
        }));
        return;
      }
  
      // 準備玩家角色資訊
      const playerInfo = playerCharacter ? {
        name: playerCharacter.name,
        role: playerCharacter.role,
        public_info: playerCharacter.public_info,
        secret: playerCharacter.secret,
        mission: playerCharacter.mission
      } : {
        name: "玩家",
        role: "調查者",
        public_info: "一個正在調查真相的人",
        secret: "想要找出事件的真相",
        mission: "收集線索並解開謎團"
      };
  
      // 發送對話請求
      const response = await chatWithNPC(roomData.script_id, playerId, npcId, {
        text: inputText,
        background: scriptData?.background || '這是一個推理遊戲',
        npc_info: {
          name: npc.name,
          description: npc.ref || '一個神秘的角色'
        },
        player_info: playerInfo,
        chat_history: []
      });
  
      // 儲存每個 NPC 對話紀錄
      setChatDialogues((prev) => ({
        ...prev,
        [npcId]: response.dialogue || 'NPC 沒有回應'
      }));
  
      if (response.hint) console.log('NPC 線索:', response.hint);
      if (response.evidence) console.log('NPC 提供證據:', response.evidence);
  
      setInputText('');
    } catch (err) {
      console.error('對話失敗:', err);
      setChatDialogues((prev) => ({
        ...prev,
        [npcId]: `對話失敗: ${err instanceof Error ? err.message : '未知錯誤'}`
      }));
    }
  };
  
  const handleNPCClick = (npc: { id: string; name: string; ref: string | null }) => {
    const confirmTalk = window.confirm(`是否要與 ${npc.name} 對話？`);
    if (confirmTalk) {
      setSelectedDetail({ type: 'npc', name: npc.name, ref: npc.ref });
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-4">
      <div className="flex justify-end">
        <div className="text-lg font-semibold text-red-600">
          倒計時：{timer} 秒
        </div>
      </div>
  
      <h3 className="text-2xl font-bold text-indigo-700">地圖探索</h3>
  
      {!selectedLocation && (
        <div className="grid grid-cols-2 gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              onClick={() => setSelectedLocation(loc.id)}
              className="p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer text-indigo-800 font-semibold text-center"
            >
              {loc.name}
            </div>
          ))}
        </div>
      )}
  
      {selectedLocation !== null && !selectedDetail && (
        <div className="space-y-4">
          <button onClick={() => setSelectedLocation(null)} className="text-sm text-blue-600 underline">
            ← 返回地圖
          </button>
          <h4 className="text-xl font-bold text-indigo-700">
            {locations.find((l) => l.id === selectedLocation)?.name}
          </h4>
  
          <div className="grid grid-cols-2 gap-4">
            {objects.filter((o) => o.map_id === selectedLocation).map((obj) => (
              <div
                key={`obj-${obj.id}`}
                onClick={() => setSelectedDetail({ type: 'object', name: obj.name, content: obj.content })}
                className="p-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg cursor-pointer text-green-800 font-semibold text-center"
              >
                {obj.name}
              </div>
            ))}
            {npcs.filter((n) => n.map_id === selectedLocation).map((npc) => (
              <div
                key={`npc-${npc.id}`}
                onClick={() => handleNPCClick(npc)}
                className="p-4 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg cursor-pointer text-yellow-800 font-semibold text-center"
              >
                {npc.name}
              </div>
            ))}
          </div>
        </div>
      )}
  
      {selectedDetail && (
        <div className="space-y-4">
          <button onClick={() => setSelectedDetail(null)} className="text-sm text-blue-600 underline">
            ← 返回 {locations.find((l) => l.id === selectedLocation)?.name}
          </button>
          {selectedDetail.type === 'object' && <h4 className="text-xl font-bold text-indigo-700">{selectedDetail.name} 的內容</h4>}
          {selectedDetail.type === 'object' && 
          <p className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-800">
            {selectedDetail.type === 'object' ? selectedDetail.content || '無更多資訊' : selectedDetail.ref || '這是 NPC，你可以開始互動！'}
          </p>
          }
          {selectedDetail.type === 'npc' && (
            <div className="space-y-2">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <h4 className="text-lg font-bold text-indigo-700">{selectedDetail.name}</h4>
                <p className="text-gray-800">
                  {chatDialogues[npcs.find((n) => n.name === selectedDetail.name)?.id || ''] || '這是 NPC，你可以開始互動！'}
                </p>

              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded p-2"
                placeholder={`對 ${selectedDetail.name} 說些什麼...`}
              />
              <button
                onClick={() => {
                  const npcId = npcs.find((n) => n.name === selectedDetail.name)?.id || '';
                  if (inputText.trim()) {
                    handleTalk(npcId);
                  } else {
                    alert("請輸入對話內容！");
                  }
                }}
                className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                送出
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );  
};

export default InvestigationPhase;
