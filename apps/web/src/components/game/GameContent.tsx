'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getGameContent } from '@/lib/map&ClueData';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

interface GameContentProps {
  roomId: string;
  playerId: string;
  playerRole: string;
  gameScript: any;
}

interface RoomUpdate {
  id: string;
  status: string;
}

export default function GameContent({
  roomId,
  playerId,
  playerRole,
  gameScript,
}: GameContentProps) {
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState<string>('introduction');
  const [timer, setTimer] = useState<number>(300); // 5分鐘倒計時
  const [playerInfo, setPlayerInfo] = useState<any>(null);
  const [discoveredClues, setDiscoveredClues] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'map' | 'chat'>('map');
  const gameContent = getGameContent();

  useEffect(() => {
    // 獲取玩家角色信息
    const character = gameScript.characters.find((c: { role: string }) => c.role === playerRole);
    if (character) {
      setPlayerInfo(character);
    }

    // 訂閱房間狀態變化
    const roomSubscription = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new && payload.new.status) {
            setCurrentPhase(payload.new.status);
          }
        }
      )
      .subscribe();

    // 如果玩家角色已選擇，保留在 role_selection 階段
    if (playerInfo) {
      setCurrentPhase('role_selection');
    }

    return () => {
      roomSubscription.unsubscribe();
    };
  }, [roomId, playerRole, gameScript, playerInfo]);

  useEffect(() => {
    // 訂閱 messages 表的變化，實時更新系統訊息
    const messageSubscription = supabase
      .channel(`messages:room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('新訊息:', payload.new);
          // 可以在此處更新本地狀態以顯示新訊息（如果需要）
        }
      )
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
    };
  }, [roomId]);

  // 確保刷新時保持當前階段
  useEffect(() => {
    const fetchRoomStatus = async () => {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('status')
        .eq('id', roomId)
        .single();

      if (!error && room) {
        setCurrentPhase(room.status);
      } else {
        console.error('獲取房間狀態失敗:', error);
      }
    };

    fetchRoomStatus();
  }, [roomId]);

  // 倒計時邏輯
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  useEffect(() => {
    const checkAllPlayersSelected = async () => {
      const { data: players, error } = await supabase
        .from('players')
        .select('role')
        .eq('room_id', roomId);

      if (error) {
        console.error('檢查玩家角色失敗:', error);
        return;
      }

      // 檢查是否所有玩家都已選擇角色
      const allSelected = players.every((player: any) => player.role);
      if (allSelected) {
        // 發送系統訊息
        const { error: messageError } = await supabase
          .from('messages')
          .insert([
            {
              room_id: roomId,
              sender_id: SYSTEM_USER_ID, // 系統訊息
              receiver_id: null,
              content: '所有玩家已選擇角色，請輪流自我介紹',
            },
          ]);

        if (messageError) {
          console.error('發送系統訊息失敗:', messageError);
        }
      }
    };

    if (currentPhase === 'role_selection') {
      checkAllPlayersSelected();
    }
  }, [currentPhase, roomId]);

  useEffect(() => {
    if (currentPhase === 'investigation') {
      setTimer(20); // 設置計時器為 1 分鐘
    }
  }, [currentPhase]);

  useEffect(() => {
    if (currentPhase !== 'investigation') return;
  
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
  
          // 切換到 discussion 階段
          (async () => {
            const { error: updateError } = await supabase
              .from('rooms')
              .update({ status: 'discussion' })
              .eq('id', roomId);
  
            if (!updateError) {
              setCurrentPhase('discussion');
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
            } else {
              console.error('更新房間狀態失敗:', updateError);
            }
          })();
  
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  
    return () => clearInterval(interval);
  }, [currentPhase, roomId]);

  useEffect(() => {
    if (currentPhase !== 'discussion') return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          // 切換到 voting 階段
          (async () => {
            const { error: updateError } = await supabase
              .from('rooms')
              .update({ status: 'voting' })
              .eq('id', roomId);

            if (!updateError) {
              setCurrentPhase('voting');
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
            } else {
              console.error('更新房間狀態失敗:', updateError);
            }
          })();

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPhase, roomId]);

  useEffect(() => {
    if (currentPhase === 'discussion') {
      setTimer(10); // 設置計時器為 10 秒
    }
  }, [currentPhase]);
  const [votes, setVotes] = useState<{ [key: string]: string }>({});
const [players, setPlayers] = useState<any[]>([]);

useEffect(() => {
  if (currentPhase !== 'voting') return;

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('id, nickname, role')
      .eq('room_id', roomId);

    if (!error && data) {
      setPlayers(data);
    } else {
      console.error('獲取玩家列表失敗:', error);
    }
  };

  fetchPlayers();
}, [currentPhase, roomId]);

  // 發現線索的處理函數
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

  const handleNextStep = async () => {
    // 更新房間狀態為 role_selection
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'role_selection' })
      .eq('id', roomId);

    if (!error) {
      // 同步更新本地狀態
      setCurrentPhase('role_selection');
    } else {
      console.error('更新房間狀態失敗:', error);
    }
  };

  const handleVote = async (targetId: string | null) => {
    // 記錄玩家的投票
    const { error } = await supabase
      .from('votes')
      .insert([
        {
          room_id: roomId,
          voter_id: playerId,
          target_id: targetId,
        },
      ]);

    if (error) {
      console.error('投票失敗:', error);
      return;
    }

    setVotes((prev) => ({ ...prev, [playerId]: targetId }));

    // 檢查是否所有玩家都已投票
    const { data: allVotes, error: fetchError } = await supabase
      .from('votes')
      .select('voter_id')
      .eq('room_id', roomId);

    if (fetchError) {
      console.error('檢查投票狀態失敗:', fetchError);
      return;
    }

    if (allVotes.length === players.length) {
      // 更新房間狀態為 ended
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: 'ended' })
        .eq('id', roomId);

      if (!updateError) {
        setCurrentPhase('ended');
        const { error: messageError } = await supabase
          .from('messages')
          .insert([
            {
              room_id: roomId,
              sender_id: SYSTEM_USER_ID,
              receiver_id: null,
              content: '投票結束，遊戲已結束。',
            },
          ]);

        if (messageError) {
          console.error('發送系統訊息失敗:', messageError);
        }
      } else {
        console.error('更新房間狀態失敗:', updateError);
      }
    }
  };

  const renderInvestigationContent = () => {
    return (
      <div className="flex">
        {/* 左側導航欄 */}
        <nav className="w-1/4 bg-gray-100 p-4 border-r">
          <ul>
            <li
              className={`cursor-pointer p-2 ${activeTab === 'map' ? 'bg-blue-200' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              地圖
            </li>
            <li
              className={`cursor-pointer p-2 ${activeTab === 'chat' ? 'bg-blue-200' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              聊天室
            </li>
          </ul>
        </nav>

        {/* 右側內容區域 */}
        <div className="w-3/4 p-4">
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
      </div>
    );
  };

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'introduction':
        return (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-xl font-bold mb-3">案件背景</h3>
            <p className="mb-4">{gameScript.background}</p>
            
            <div className="mt-6">
              <h4 className="font-semibold mb-2">遊戲流程</h4>
              <ol className="list-decimal pl-5 space-y-1">
                {gameScript.flow.map((step: string, index: number) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {/* 新增下一步按鈕 */}
            <div className="mt-6 text-center">
              <button
                onClick={handleNextStep}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                下一步
              </button>
            </div>
          </div>
        );

      case 'role_selection':
        return (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-xl font-bold mb-3">角色選擇階段</h3>
            {!playerInfo ? (
              <>
                <p className="mb-4">請選擇你的角色。</p>
                <div className="grid grid-cols-2 gap-4">
                  {gameScript.characters.map((character: any, index: number) => (
                    <button
                      key={index}
                      className="p-4 bg-blue-50 rounded border hover:bg-blue-100"
                      onClick={async () => {
                        // 1. 更新玩家角色
                        const { error: updateError } = await supabase
                          .from('players')
                          .update({ role: character.role })
                          .eq('id', playerId);
                      
                        if (updateError) {
                          console.error('角色更新失敗：', updateError);
                          return;
                        }
                      
                        setPlayerInfo(character);
                        // 查詢玩家資料
                        const { data: player, error: fetchError } = await supabase
                        .from('players')
                        .select('nickname')
                        .eq('id', playerId)
                        .single();
                        if (fetchError) {
                          console.error('查詢玩家名稱失敗:', fetchError);
                        }
                        console.log('玩家名稱:', player?.nickname);
                        // 2. 發送系統訊息
                        const { error: messageError } = await supabase
                          .from('messages')
                          .insert([
                            {
                              room_id: roomId,
                              sender_id: SYSTEM_USER_ID, // 你也可以填 playerId，但要確保前端識別這是系統訊息
                              receiver_id: null,
                              content: `${player?.nickname} 已選擇角色 ${character.name}`,
                            },
                          ]);
                      
                        if (messageError) {
                          console.error('發送系統訊息失敗：', messageError);
                        }
                      }}
                    >
                      <h4 className="font-semibold">{character.name}</h4>
                      <p className="text-sm text-gray-600">{character.public_info}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-6">
                <h4 className="font-semibold mb-2">你的角色：{playerInfo.name}</h4>
                <div className="bg-blue-50 p-3 rounded border border-blue-100">
                  <p><span className="font-medium">公開信息：</span> {playerInfo.public_info}</p>
                  
                  {playerInfo.secret && (
                    <p className="mt-2"><span className="font-medium text-red-600">秘密：</span> {playerInfo.secret}</p>
                  )}
                  
                  {playerInfo.mission && (
                    <p className="mt-2"><span className="font-medium text-green-600">任務：</span> {playerInfo.mission}</p>
                  )}
                </div>
              </div>
            )}
            {playerInfo &&(
              <div className="mt-6 text-center">
                <button
                  onClick={async () => {
                    // 更新房間狀態為 investigation
                    const { error } = await supabase
                      .from('rooms')
                      .update({ status: 'investigation' })
                      .eq('id', roomId);

                    if (!error) {
                      setCurrentPhase('investigation');
                    } else {
                      console.error('更新房間狀態失敗:', error);
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  下一步
                </button>
              </div>
            )}
          </div>
        );

      case 'investigation':
        return renderInvestigationContent();
        
      case 'discussion':
        return (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold">討論階段</h3>
              <span className="text-lg font-bold text-red-600">倒計時：{timer} 秒</span>
            </div>
            <p>與其他玩家討論案件，分享線索，找出兇手。</p>
          </div>
        );
        
        case 'voting':
          return (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="text-xl font-bold mb-3">投票階段</h3>
              <p className="mb-4">根據討論結果，投票選出你認為的兇手。</p>
              <ul className="mb-4">
                {players.map((player) => (
                  <li key={player.id} className="mb-2">
                    <button
                      onClick={() => handleVote(player.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={!!votes[playerId]}
                    >
                      投票給 {player.role}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    onClick={() => handleVote(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    disabled={!!votes[playerId]}
                  >
                    棄票
                  </button>
                </li>
              </ul>
              {votes[playerId] && <p className="text-green-600">你已完成投票。</p>}
            </div>
          );
    
        case 'ended':
          return (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="text-xl font-bold mb-3">遊戲結束</h3>
              <p>遊戲已結束，感謝參與！</p>
            </div>
          );
    
        default:
          return (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="text-xl font-bold mb-3">等待中</h3>
              <p>等待遊戲開始...</p>
            </div>
          );
      }
    };

  return (
    <div className="my-6">
      {renderPhaseContent()}
    </div>
  );
}