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
  // 基本狀態
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
<<<<<<< Updated upstream
  const [selectedItem, setSelectedItem] = useState<{ name: string; clue: string } | null>(null);
=======
  const [selectedDetail, setSelectedDetail] = useState<{ 
    type: 'object' | 'npc'; 
    name: string; 
    content?: string | null; 
    ref?: string | null;
    description?: string | null;
  } | null>(null);
  
  // 資料狀態
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [objects, setObjects] = useState<{ 
    id: string; 
    map_id: string; 
    name: string; 
    content: string | null;
    lock: string | null;
  }[]>([]);
  const [npcs, setNpcs] = useState<{ 
    id: string; 
    map_id: string; 
    name: string; 
    ref: string | null;
    description: string | null;
  }[]>([]);
  
  // 遊戲資料狀態
  const [gameBackground, setGameBackground] = useState<string>('');
  const [scriptData, setScriptData] = useState<any>(null);
  
  // 對話相關狀態
  const [chatDialogue, setChatDialogue] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    sender: 'player' | 'npc', 
    message: string, 
    npcName?: string
  }>>([]);
>>>>>>> Stashed changes

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
  }, [roomId, setCurrentPhase, setTimer]);

<<<<<<< Updated upstream
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
=======
  // 取得資料
  useEffect(() => {
    async function fetchData() {
      try {
        // 取得房間的 script_id
        const { data: roomData, error: roomError } = await supabase
          .from('room')
          .select('script_id')
          .eq('id', roomId)
          .single();
        
        if (roomError || !roomData?.script_id) {
          console.error('取得房間 script_id 失敗:', roomError);
          return;
        }
        const scriptId = roomData.script_id;

        // 取得劇本資料（包含背景故事）
        const { data: scriptInfo } = await supabase
          .from('gamescript')
          .select('background, title, description')
          .eq('id', scriptId)
          .single();
        
        if (scriptInfo) {
          setGameBackground(scriptInfo.background || '這是一個神秘的劇本殺遊戲');
          setScriptData(scriptInfo);
        }

        // 取得地點資料
        const { data: locs } = await supabase
          .from('gamemap')
          .select('id, name')
          .eq('script_id', scriptId);
        
        // 取得物件資料（包含 lock 欄位）
        const { data: objs } = await supabase
          .from('gameobject')
          .select('id, map_id, name, content, lock')
          .eq('script_id', scriptId);
        
        // 取得 NPC 資料
        const { data: npcs } = await supabase
          .from('gamenpc')
          .select('id, map_id, name, ref, description')
          .eq('script_id', scriptId);

        setLocations(locs || []);
        setObjects(objs || []);
        setNpcs(npcs || []);

        console.log('資料載入完成:', { locs, objs, npcs, scriptInfo });
      } catch (error) {
        console.error('載入資料失敗:', error);
      }
    }
    fetchData();
  }, [roomId]);

  // 根據 NPC ID 獲取可解鎖物件的函數
  const getUnlockableObjects = (npcId: string) => {
    return objects
      .filter(obj => obj.lock === npcId)
      .map(obj => {
        const location = locations.find(loc => loc.id === obj.map_id);
        return {
          id: obj.id,
          name: obj.name,
          content: obj.content,
          location_name: location?.name || '未知地點'
        };
      });
  };

  // 對話處理函數
  const handleTalk = async (npcId: string, npcName: string) => {
    if (!inputText.trim()) {
      alert('請輸入要對 NPC 說的話');
      return;
    }

    if (!gameBackground) {
      alert('遊戲背景載入中，請稍後再試');
      return;
    }

    setIsTyping(true);
    
    // 添加玩家的話到歷史記錄
    const playerMessage = inputText;
    setChatHistory(prev => [...prev, { sender: 'player', message: playerMessage }]);

    try {
      // 獲取該 NPC 可解鎖的物件
      const unlockableObjects = getUnlockableObjects(npcId);
      
      // 找到當前 NPC 的詳細資訊
      const currentNpc = npcs.find(npc => npc.id === npcId);
      if (!currentNpc) {
        throw new Error('找不到 NPC 資訊');
      }

      // 將對話歷史轉換為後端需要的格式
      const formattedHistory = chatHistory.map(chat => ({
        role: chat.sender === 'player' ? 'user' : 'assistant',
        content: chat.message
      }));
      
      console.log('發送對話請求:', {
        npcId,
        npcName,
        unlockableObjects,
        background: gameBackground.substring(0, 50) + '...'
      });
      
      const response = await chatWithNPC(roomCode, playerId, npcId, {
        text: inputText,
        background: gameBackground,
        npc_info: {
          name: currentNpc.name,
          description: currentNpc.ref || currentNpc.description || '這是一個神秘的 NPC',
          secret: '',
          mission: ''
        },
        chat_history: formattedHistory,
        unlockable_objects: unlockableObjects,
      });

      const npcResponse = response.dialogue || 'NPC 沒有回應';
      
      // 添加 NPC 的回應到歷史記錄
      setChatHistory(prev => [...prev, { 
        sender: 'npc', 
        message: npcResponse, 
        npcName: npcName 
      }]);

      setChatDialogue(npcResponse);
      
      // 處理線索和證據
      if (response.hint) {
        console.log('NPC 線索:', response.hint);
        // 可以添加到 UI 顯示線索
      }
      if (response.evidence) {
        console.log('NPC 提供證據:', response.evidence);
        // 可以更新到 Supabase 或本地狀態
      }
      
      // 清空輸入框
      setInputText('');
    } catch (err) {
      console.error('對話失敗:', err);
      setChatDialogue('對話失敗，請稍後再試');
      // 移除剛才添加的玩家訊息
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setIsTyping(false);
    }
  };

  // 按 Enter 鍵發送訊息
  const handleKeyPress = (e: React.KeyboardEvent, npcId: string, npcName: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTalk(npcId, npcName);
    }
  };

  // 格式化計時器顯示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg border min-h-screen">
      {/* 標題和計時器 */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">🔍 蒐證階段</h2>
        <div className="text-right">
          <div className="text-lg font-bold text-red-600">
            倒計時：{formatTime(timer)}
          </div>
          {scriptData && (
            <div className="text-sm text-gray-600 mt-1">
              劇本：{scriptData.title || '未知劇本'}
            </div>
          )}
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-bold mb-3">🗺️ 地圖探索</h3>

        {/* 地點選擇 */}
        {!selectedLocation && (
          <div>
            <p className="text-gray-600 mb-3">選擇一個地點開始探索：</p>
            <div className="grid grid-cols-2 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => setSelectedLocation(loc.id)}
                  className="p-4 bg-indigo-100 rounded-lg hover:bg-indigo-200 cursor-pointer transition-colors shadow-sm border border-indigo-200"
                >
                  <div className="font-semibold text-indigo-800">{loc.name}</div>
>>>>>>> Stashed changes
                </div>
              ))}
            </div>
          )}

<<<<<<< Updated upstream
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
=======
        {/* 地點詳情 - 顯示物件和 NPC */}
        {selectedLocation !== null && !selectedDetail && (
          <div>
            <button 
              onClick={() => setSelectedLocation(null)} 
              className="text-sm text-blue-600 underline mb-3 hover:text-blue-800"
            >
              ← 返回地圖
            </button>
            <h4 className="text-xl font-bold mb-3 text-gray-800">
              📍 {locations.find((l) => l.id === selectedLocation)?.name}
            </h4>

            <div className="grid grid-cols-2 gap-4">
              {/* 物件 */}
              {objects.filter((o) => o.map_id === selectedLocation).map((obj) => (
                <div
                  key={`obj-${obj.id}`}
                  onClick={() => setSelectedDetail({ 
                    type: 'object', 
                    name: obj.name, 
                    content: obj.content 
                  })}
                  className="p-4 bg-green-100 rounded-lg hover:bg-green-200 cursor-pointer transition-colors shadow-sm border border-green-200"
                >
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">📦</span>
                    <span className="font-semibold text-green-800">{obj.name}</span>
                  </div>
                </div>
              ))}
              
              {/* NPC */}
              {npcs.filter((n) => n.map_id === selectedLocation).map((npc) => (
                <div
                  key={`npc-${npc.id}`}
                  onClick={() => setSelectedDetail({ 
                    type: 'npc', 
                    name: npc.name, 
                    ref: npc.ref,
                    description: npc.description
                  })}
                  className="p-4 bg-yellow-100 rounded-lg hover:bg-yellow-200 cursor-pointer transition-colors shadow-sm border border-yellow-200"
                >
                  <div className="flex items-center">
                    <span className="text-yellow-600 mr-2">👤</span>
                    <span className="font-semibold text-yellow-800">{npc.name}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 如果地點沒有物件和 NPC */}
            {objects.filter((o) => o.map_id === selectedLocation).length === 0 && 
             npcs.filter((n) => n.map_id === selectedLocation).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>這個地點看起來很安靜，沒有發現任何可互動的物件或人物。</p>
              </div>
            )}
          </div>
        )}

        {/* 物件詳情 */}
        {selectedDetail && selectedDetail.type === 'object' && (
          <div>
            <button 
              onClick={() => setSelectedDetail(null)} 
              className="text-sm text-blue-600 underline mb-3 hover:text-blue-800"
            >
              ← 返回 {locations.find((l) => l.id === selectedLocation)?.name}
            </button>
            <h4 className="text-xl font-bold mb-3 text-gray-800">
              📦 {selectedDetail.name}
            </h4>
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <p className="text-gray-700 leading-relaxed">
                {selectedDetail.content || '這個物件看起來很普通，沒有發現特別的線索。'}
              </p>
            </div>
          </div>
        )}

        {/* NPC 互動 */}
        {selectedDetail && selectedDetail.type === 'npc' && (
          <div>
            <button 
              onClick={() => setSelectedDetail(null)} 
              className="text-sm text-blue-600 underline mb-3 hover:text-blue-800"
            >
              ← 返回 {locations.find((l) => l.id === selectedLocation)?.name}
            </button>
            <h4 className="text-xl font-bold mb-3 text-gray-800">
              👤 與 {selectedDetail.name} 對話
            </h4>
            
            {/* NPC 基本資訊 */}
            <div className="bg-white p-4 rounded-lg border shadow-sm mb-4">
              <p className="text-gray-700 leading-relaxed">
                {selectedDetail.ref || selectedDetail.description || '這個人看起來有話想說...'}
              </p>
            </div>
            
            {/* 顯示該 NPC 可解鎖的物件提示 */}
            {(() => {
              const currentNpcId = npcs.find((n) => n.name === selectedDetail.name)?.id || '';
              const unlockableObjects = getUnlockableObjects(currentNpcId);
              
              return unlockableObjects.length > 0 && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4">
                  <h5 className="font-bold text-sm text-yellow-800 mb-2 flex items-center">
                    💡 線索提示
                  </h5>
                  <p className="text-sm text-gray-700 mb-2">
                    {selectedDetail.name} 可能知道以下物件的相關信息：
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {unlockableObjects.map(obj => (
                      <li key={obj.id} className="flex items-center">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                        <span className="font-medium">{obj.name}</span>
                        <span className="text-gray-500 ml-1">(位於{obj.location_name})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            
            {/* 對話歷史 */}
            {chatHistory.length > 0 && (
              <div className="mb-4 max-h-60 overflow-y-auto bg-white p-3 rounded-lg border shadow-sm">
                <h5 className="font-bold mb-3 text-gray-800 flex items-center">
                  💬 對話記錄
                </h5>
                <div className="space-y-2">
                  {chatHistory.map((chat, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg ${
                        chat.sender === 'player' 
                          ? 'bg-blue-50 border-l-4 border-blue-400 ml-4' 
                          : 'bg-gray-50 border-l-4 border-gray-400 mr-4'
                      }`}
                    >
                      <div className="text-sm text-gray-600 mb-1">
                        {chat.sender === 'player' ? '🗣️ 你' : `👤 ${chat.npcName}`}:
                      </div>
                      <div className="text-gray-800 whitespace-pre-wrap">{chat.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 對話輸入區域 */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h5 className="font-bold mb-3 text-gray-800">💭 與 {selectedDetail.name} 交流</h5>
              <div className="space-y-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, npcs.find((n) => n.name === selectedDetail.name)?.id || '', selectedDetail.name)}
                  placeholder={`輸入你想對 ${selectedDetail.name} 說的話...\n\n💡 你可以詢問關於線索、物件或其他相關問題\n按 Shift+Enter 換行，Enter 發送`}
                  className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  disabled={isTyping}
                />
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const currentNpcId = npcs.find((n) => n.name === selectedDetail.name)?.id || '';
                      const unlockableCount = getUnlockableObjects(currentNpcId).length;
                      return unlockableCount > 0 ? (
                        `💬 提示：嘗試詢問關於特定物件或地點，${selectedDetail.name} 可能會提供 ${unlockableCount} 個物件的線索`
                      ) : (
                        '💬 嘗試與這個角色進行對話，看看能發現什麼線索'
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => handleTalk(npcs.find((n) => n.name === selectedDetail.name)?.id || '', selectedDetail.name)}
                    disabled={isTyping || !inputText.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {isTyping ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        對話中...
                      </>
                    ) : (
                      <>
                        <span className="mr-2">💬</span>
                        發送訊息
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 載入狀態提示 */}
      {!gameBackground && (
        <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-lg">
          <span className="animate-pulse">📡 載入遊戲資料中...</span>
>>>>>>> Stashed changes
        </div>
      )}
    </div>
  );
};

export default InvestigationPhase;