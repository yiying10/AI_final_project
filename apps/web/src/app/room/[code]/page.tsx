'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  is_ready: boolean;
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
  const codeParam = params.code as string;

  const [room, setRoom] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [story, setStory] = useState<GameScript | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);

  // 載入房間和玩家資訊
  useEffect(() => {
    if (!codeParam) return;

    async function fetchRoomAndPlayer() {
      setLoading(true);

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

      const userCode = localStorage.getItem('user_code');
      const { data: player, error: playerErr } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)
        .eq('nickname', userCode)
        .single();

      if (playerErr || !player) {
        setError('找不到對應的玩家');
        setPlayer(null);
      } else {
        setPlayer(player);
        setError('');
      }

      setLoading(false);
    }

    fetchRoomAndPlayer();
  }, [codeParam]);

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
      supabase.removeChannel(roomChannel);
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

  // 訂閱角色選擇變化
  useEffect(() => {
    if (!room) return;

    const roleChannel = supabase
      .channel(`room-${room.id}-roles`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
        async () => {
          const { data: players } = await supabase
            .from('players')
            .select('id, nickname, role, is_ready')
            .eq('room_id', room.id);

          if (players) {
            // 確保所有必需的字段都存在
            const validPlayers = players.map(p => ({
              id: p.id,
              nickname: p.nickname,
              role: p.role || '',
              is_ready: p.is_ready || false
            }));
            setPlayers(validPlayers);
            setRoles(prevRoles => 
              prevRoles.map(role => ({
                ...role,
                selected: validPlayers.some(p => p.role === role.id),
                selectedBy: validPlayers.find(p => p.role === role.id)?.nickname
              }))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roleChannel);
    };
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
          status: 'role_selection',
          current_phase: 'introduction'
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
          sender_id: 'system',
          receiver_id: 'system',
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
        sender_id: 'system',
        receiver_id: 'system',
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
          人數：{playerCount} / {room.max_players}
        </p>
      </div>

      {/* 房主控制面板 */}
      {player.is_host && room.status === 'waiting' && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h3 className="text-lg font-semibold mb-2">房主控制面板</h3>
          <button
            onClick={handleGenerateStory}
            disabled={generatingStory || playerCount < 4}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {generatingStory ? '生成劇本中...' : '開始遊戲'}
          </button>
          {playerCount < 4 && (
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
        <ChatRoom
          roomId={room.id}
          playerId={player.id}
          onPlayersChange={(players) => setPlayerCount(players.length)}
        />
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

function PlayerCount({ roomId }: { roomId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      const { data } = await supabase.from('players').select('id').eq('room_id', roomId);
      if (data) setCount(data.length);
    }
    fetchCount();
  }, [roomId]);

  return <>{count}</>;
}
