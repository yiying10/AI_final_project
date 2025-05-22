'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { generateStory, validateAction } from '@/lib/storyGenerator';
import ChatRoom from '@/components/ChatRoom';
import Investigation from '@/components/game/Investigation';
import Discussion from '@/components/game/Discussion';
import { toast } from 'react-hot-toast';
import GameContent from '@/components/game/GameContent';

// 遊戲狀態
type GameStatus = 'waiting' | 'selecting_roles' | 'introduction' | 'investigation' | 'discussion' | 'voting' | 'ended';

// 角色資訊
interface Role {
  id: string;
  name: string;
  description: string;
  selected: boolean;
  selectedBy?: string;
}

interface Player {
  id: string;
  nickname: string;
  role: string;
}

interface Evidence {
  id: string;
  name: string;
  description: string;
  found: boolean;
}

interface GameScript {
  id: string;
  title: string;
  background: string;
  scene: string;
  time_setting: string;
  summary: string;
  characters: {
    name: string;
    role: string;
    public_info: string;
    secret: string;
    mission: string;
  }[];
  clues: string[];
  flow: string[];
  victory_rules: {
    murderer_win: string;
    justice_win: string;
    neutral_win: string;
  };
}

interface Story {
  title: string;
  background: string;
  characters: {
    murderer: {
      name: string;
      description: string;
      motive: string;
    };
    detective: {
      name: string;
      description: string;
      clues: string[];
    };
    witness: {
      name: string;
      description: string;
      testimony: string;
    };
    suspect: {
      name: string;
      description: string;
      alibi: string;
    };
  };
  locations: {
    id: string;
    name: string;
    description: string;
    evidence: {
      id: string;
      name: string;
      description: string;
      isDirect: boolean;
    }[];
  }[];
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const codeParam = params.code as string;

  const [room, setRoom] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [story, setStory] = useState<GameScript | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);

  // 載入房間和玩家資訊
  useEffect(() => {
    if (!codeParam) return;

    // 從 localStorage 獲取玩家 ID
    const savedPlayerId = localStorage.getItem(`player_id_${codeParam}`);
    console.log('從 localStorage 獲取玩家 ID:', savedPlayerId);

    async function fetchRoomAndPlayer() {
      setLoading(true);

      try {
        // 获取房间信息
        const { data: room, error: roomErr } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', codeParam)
          .single();

        if (roomErr || !room) {
          setError('找不到該房間');
          setLoading(false);
          return;
        }

        setRoom(room);

        // 获取当前房间的所有玩家
        const { data: allPlayers } = await supabase
          .from('players')
          .select('id, nickname, role, is_host')
          .eq('room_id', room.id);

        // 如果有保存的玩家ID，尋找對應玩家
        if (savedPlayerId && allPlayers) {
          const savedPlayer = allPlayers.find(p => p.id === savedPlayerId);
          if (savedPlayer) {
            console.log('找到已保存的玩家:', savedPlayer.nickname);
            setPlayer(savedPlayer);
            setPlayers(allPlayers);
            setLoading(false);
            return;
          }
        }

        // 如果找不到保存的玩家ID或對應玩家不存在，創建新玩家
        console.log('找不到已保存的玩家，創建新玩家');
        
        // 获取昵称（优先使用自定义昵称，如果没有则使用随机编号）
        const customNickname = localStorage.getItem('user_nickname');
        
        // 生成随机4位数字
        const generateRandomNumber = () => {
          return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        };

        // 获取已使用的编号
        const usedNumbers = allPlayers
          ? allPlayers
              .map(p => p.nickname.match(/玩家(\d{4})/)?.[1])
              .filter(Boolean)
          : [];

        // 生成未使用的随机编号
        let randomNumber;
        do {
          randomNumber = generateRandomNumber();
        } while (usedNumbers.includes(randomNumber));

        const defaultNickname = `玩家${randomNumber}`;
        const finalNickname = customNickname || defaultNickname;
        
        // 创建新玩家（不需要提供id，数据库会自动生成）
        const isHost = !allPlayers || allPlayers.length === 0;
        console.log('準備創建新玩家，房間ID:', room.id, '暱稱:', finalNickname, '是否為房主:', isHost);
        
        try {
          const { data: newPlayer, error: createErr } = await supabase
            .from('players')
            .insert([
              {
                room_id: room.id,
                nickname: finalNickname,
                is_host: isHost,
                joined_at: new Date().toISOString()
              }
            ])
            .select()
            .single();

          if (createErr) {
            console.error('创建玩家失败，錯誤詳情:', createErr);
            setError('創建玩家失敗: ' + createErr.message);
            setLoading(false);
            return;
          }

          if (!newPlayer) {
            console.error('创建玩家失败: 未返回玩家數據');
            setError('創建玩家失敗: 未返回玩家數據');
            setLoading(false);
            return;
          }

          console.log('成功创建新玩家:', newPlayer);
          
          // 保存玩家ID到localStorage
          localStorage.setItem(`player_id_${codeParam}`, newPlayer.id);
          localStorage.setItem(`player_created_${codeParam}`, 'true');

          // 如果是房主，更新房间的创建者ID
          if (isHost) {
            const { error: updateRoomErr } = await supabase
              .from('rooms')
              .update({ creator_id: newPlayer.id })
              .eq('id', room.id);

            if (updateRoomErr) {
              console.error('更新房间创建者失败:', updateRoomErr);
            }
          }

          setPlayer(newPlayer);
          setPlayers(allPlayers ? [...allPlayers, newPlayer] : [newPlayer]);
        } catch (insertError) {
          console.error('創建玩家時發生異常:', insertError);
          setError('創建玩家時發生異常: ' + (insertError instanceof Error ? insertError.message : '未知錯誤'));
          setLoading(false);
          return;
        }

        setError('');
      } catch (error) {
        console.error('加载房间和玩家信息失败:', error);
        setError('加載失敗');
      } finally {
        setLoading(false);
      }
    }

    fetchRoomAndPlayer();
  }, [codeParam]); // 只依赖codeParam，避免重复执行

  // 載入並訂閱玩家列表（channel API）
  useEffect(() => {
    if (!room) return;

    async function loadPlayers() {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id, nickname, role, is_host')
          .eq('room_id', room.id);
          
        if (error) {
          console.error('加载玩家列表失败:', error);
          return;
        }
        
        if (data) {
          // 确保当前玩家在列表中
          const currentPlayerInList = player ? data.some(p => p.id === player.id) : false;
          
          const validPlayers = data.map(p => ({
            id: p.id,
            nickname: p.nickname,
            role: p.role || '',
            is_host: p.is_host
          }));
          
          setPlayers(validPlayers);
          console.log('更新玩家列表:', validPlayers.length);
          
          // 如果当前玩家不在列表中，可能是被删除了
          if (player && !currentPlayerInList) {
            console.log('当前玩家不在列表中，可能已被删除');
            setError('你的玩家資料已被刪除，請返回主頁面重新加入房間');
          }
        }
      } catch (err) {
        console.error('加载玩家列表时出错:', err);
      }
    }

    // 创建实时订阅
    const playerChannel = supabase
      .channel(`room-${room.id}-players`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`
        },
        (payload) => {
          console.log('收到玩家变更:', payload);
          loadPlayers(); // 任何玩家变更都更新列表
        }
      )
      .subscribe((status) => {
        console.log('订阅状态:', status);
      });

    // 初始加载
    loadPlayers();

    return () => {
      playerChannel.unsubscribe();
    };
  }, [room, player]);

  // 處理玩家離開房間 - 只在瀏覽器關閉時執行
  useEffect(() => {
    // 只在真正離開頁面時執行清理
    const handleBeforeUnload = () => {
      if (player && room) {
        console.log('頁面即將關閉，發送離開請求:', player.id);
        
        // 使用同步請求確保在頁面卸載前發送
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/leave-room', false); // 同步請求
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({
          playerId: player.id,
          roomId: room.id,
          isHost: player.is_host
        }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 不再自動刪除玩家，避免在頁面重新渲染時誤刪
    };
  }, [player, room]);

  // 新增一個函數用於手動離開房間
  const leaveRoom = async () => {
    if (player && room) {
      console.log('手動離開房間:', player.id);
      
      // 删除玩家记录
      await supabase
        .from('players')
        .delete()
        .eq('id', player.id);

      // 如果房主离开，删除房间
      if (player.is_host) {
        // 刪除房間前，清除該房間相關的localStorage記錄
        localStorage.removeItem(`player_id_${codeParam}`);
        
        await supabase
          .from('rooms')
          .delete()
          .eq('id', room.id);
      }
      
      // 導航回主頁
      router.push('/');
    }
  };

  // 訂閱房間狀態變化
  useEffect(() => {
    if (!room) return;

    const roomChannel = supabase
      .channel(`room-${room.id}-status`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updatedRoom = payload.new as any;
          setRoom(updatedRoom);
          setGameStatus(updatedRoom.status as GameStatus);
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
    };
  }, [room]);

  // 初始化角色列表
  useEffect(() => {
    if (!room) return;

    const initialRoles: Role[] = [
      {
        id: 'murderer',
        name: '兇手',
        description: '你是兇手，需要隱藏自己的身份。',
        selected: false,
      },
      {
        id: 'detective',
        name: '偵探',
        description: '你是偵探，需要找出兇手。',
        selected: false,
      },
      {
        id: 'witness',
        name: '目擊者',
        description: '你看到了案發過程，但記憶有些模糊。',
        selected: false,
      },
      {
        id: 'suspect',
        name: '嫌疑人',
        description: '你是嫌疑人之一，需要證明自己的清白。',
        selected: false,
      },
    ];

    setRoles(initialRoles);
  }, [room]);

  // 生成劇本
  async function handleGenerateStory() {
    if (!room || !player.is_host) return;
    
    setGeneratingStory(true);
    try {
      // 檢查是否已經有劇本
      if (room.script_id) {
        const { data: existingScript, error: fetchError } = await supabase
          .from('game_scripts')
          .select('*')
          .eq('id', room.script_id)
          .single();

        if (!fetchError && existingScript) {
          setStory(existingScript);
          toast.success('已載入現有劇本');
          return;
        }
      }

      // 生成新劇本
      const newScript = await generateStory(room.id);
      if (!newScript) {
        throw new Error('生成劇本失敗：未返回劇本數據');
      }
      
      // 更新房間狀態
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ 
          script_id: newScript.id,
          status: 'role_selection'
        })
        .eq('id', room.id);

      if (roomError) {
        throw new Error(`更新房間狀態失敗：${roomError.message}`);
      }

      setStory(newScript);
      setGameStatus('role_selection' as GameStatus);
      
      // 發送系統訊息
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          room_id: room.id,
          sender_id: player.id,
          receiver_id: null,
          content: `劇本已生成：${newScript.title}\n${newScript.background}`,
        }]);

      if (messageError) {
        console.error('發送系統訊息失敗：', messageError);
      }

      toast.success('劇本生成成功！');
    } catch (error) {
      console.error('生成劇本失敗：', error);
      toast.error(error instanceof Error ? error.message : '生成劇本失敗，請重試');
    } finally {
      setGeneratingStory(false);
    }
  }

  // 驗證玩家行為
  async function handleValidateAction(action: string) {
    if (!story || !player.role) return;
    
    try {
      const result = await validateAction(story, action, player.role);
      
      if (!result.valid) {
        toast.error(result.message);
      }
      
      return result.valid;
    } catch (error) {
      console.error('驗證行為失敗：', error);
      return true; // 如果驗證失敗，暫時允許行為
    }
  }

  // 載入劇本
  useEffect(() => {
    if (!room) return;
    
    if (room.script_id) {
      // 從數據庫載入劇本
      supabase
        .from('game_scripts')
        .select('*')
        .eq('id', room.script_id)
        .single()
        .then(({ data: script, error }) => {
          if (error) {
            console.error('載入劇本失敗：', error);
            return;
          }
          if (script) {
            setStory(script);
          }
        });
    }
  }, [room]);

  // 開始遊戲
  const startGame = async () => {
    try {
      // 檢查是否所有玩家都已準備
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id);

      if (!players || players.length < 6) {
        toast.error('需要至少6名玩家才能開始遊戲');
        return;
      }

      const allReady = players.every(p => p.is_ready);
      if (!allReady) {
        toast.error('所有玩家都必須準備好才能開始遊戲');
        return;
      }

      // 生成遊戲劇本
      const script = await generateStory(room.id);

      // 隨機分配角色
      const roles = script.characters.map(c => c.role);
      const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);
      
      // 更新每個玩家的角色
      const roleUpdates = players.map((player, index) => ({
        id: player.id,
        role: shuffledRoles[index],
        is_ready: false // 重置準備狀態
      }));

      const { error: roleError } = await supabase
        .from('players')
        .upsert(roleUpdates);

      if (roleError) throw roleError;

      // 更新房間狀態
      const { error: roomError } = await supabase
        .from('rooms')
        .update({
          status: 'role_selection',
          script_id: script.id,
          started_at: new Date().toISOString()
        })
        .eq('id', room.id);

      if (roomError) throw roomError;

      toast.success('遊戲開始！請選擇你的角色');
    } catch (error) {
      console.error('開始遊戲時出錯：', error);
      toast.error('開始遊戲失敗，請重試');
    }
  };

  // 選擇角色
  async function selectRole(roleId: string) {
    if (!room || !player || selectedRole) return;

    await supabase
      .from('players')
      .update({ role: roleId })
      .eq('id', player.id);

    setSelectedRole(roleId);

    // 發送系統訊息
    await supabase.from('messages').insert([
      {
        room_id: room.id,
        sender_id: player.id,
        receiver_id: null,
        content: `${player.nickname} 選擇了角色。`,
      },
    ]);
  }

  if (loading) return <p className="p-6 text-center">載入中...</p>;
  if (error) return <p className="p-6 text-center text-red-600">{error}</p>;
  if (!room || !player) return null;

  return (
    <main className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-1">房間代碼：{room.code}</h2>
      <p className="text-gray-600 text-sm mb-4">你的名稱：{player.nickname}</p>
      <p>狀態：{room.status}</p>
      <div className="bg-gray-100 px-3 py-2 rounded mb-4">
        <p className="font-medium">
          人數：{players.length} / {room.max_players}
        </p>
      </div>

      {/* 離開房間按鈕 */}
      <button
        onClick={leaveRoom}
        className="mb-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        離開房間
      </button>

      {/* 房主控制面板 */}
      {player.is_host && room.status === 'waiting' && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h3 className="text-lg font-semibold mb-2">房主控制面板</h3>
          <button
            onClick={handleGenerateStory}
            disabled={generatingStory || players.length < 4}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {generatingStory ? '生成劇本中...' : '開始遊戲'}
          </button>
          {players.length < 4 && (
            <p className="text-sm text-red-600 mt-2">需要至少4名玩家才能開始遊戲</p>
          )}
        </div>
      )}

      {/* 遊戲內容 */}
      {room.status !== 'waiting' && story && (
        <GameContent
          roomId={room.id}
          playerId={player.id}
          playerRole={player.role}
          gameScript={story}
        />
      )}

      {/* 聊天室 */}
      <div className="mt-6 border rounded bg-white shadow">
        <ChatRoom roomId={room.id} playerId={player.id} players={players} />
      </div>

      {gameStatus === 'investigation' && (
        <Investigation
          roomId={room.id}
          playerId={player.id}
          playerName={player.nickname}
          role={player.role}
          onEvidenceFound={(evidenceId) => {
            // 處理證物發現邏輯
          }}
        />
      )}

      {gameStatus === 'discussion' && (
        <Discussion
          roomId={room.id}
          playerId={player.id}
          players={players}
          evidence={evidence}
          onVote={(suspectId: string) => {
            // 處理投票邏輯
          }}
        />
      )}
    </main>
  );
}
