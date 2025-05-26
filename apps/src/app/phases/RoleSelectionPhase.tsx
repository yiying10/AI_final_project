'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SYSTEM_USER_ID } from '../lib/config';

interface RoleSelectionPhaseProps {
  playerId: string;
  roomId: string;
  isHost: boolean;
  setCurrentPhase: (phase: string) => void;
  currentPhase: string;
}

interface Player {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  role_id: string;
}

interface GameRole {
  id: string;
  script_id: string;
  name: string;
  public_info: string;
  secret: string;
  mission: string;
}

export default function RoleSelectionPhase({
  playerId,
  roomId,
  isHost,
  setCurrentPhase,
  currentPhase,
}: RoleSelectionPhaseProps) {
  const [playerInfo, setPlayerInfo] = useState<GameRole | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [characters, setCharacters] = useState<GameRole[]>([]); // 劇本角色列表
  const [allSelected, setAllSelected] = useState(false);


  // 載入劇本角色
  useEffect(() => {
    const fetchScript = async () => {
      // 先查 Room 拿到 script_id
      const { data: roomData, error: roomError } = await supabase
        .from('room')
        .select('script_id')
        .eq('id', roomId)
        .single();
  
      if (roomError || !roomData?.script_id) {
        console.error('讀取房間劇本失敗:', roomError);
        return;
      }
  
      const scriptId = roomData.script_id;
  
      // 再查 GameRole 拿到角色清單
      const { data: rolesData, error: rolesError } = await supabase
        .from('GameRole')
        .select('id, script_id, name, public_info, secret, mission')
        .eq('script_id', scriptId);
  
      if (rolesError || !rolesData) {
        console.error('讀取角色資料失敗:', rolesError);
        return;
      }
  
      // 將角色清單存入 state
      setCharacters(rolesData);
    };
  
    fetchScript();
  }, [roomId]);
  

  const fetchInitialData = async () => {
    const [{ data: playerData }, { data: allPlayers }] = await Promise.all([
      supabase.from('player').select('role_id').eq('id', playerId).single(),
      supabase.from('player').select('role_id').eq('room_id', roomId),
    ]);

    if (playerData?.role_id) {
      const selected = characters.find((c) => c.id === playerData.role_id);
      if (selected) setPlayerInfo(selected);
    }

    const selected = allPlayers?.map((p: any) => p.role_id).filter(Boolean) || [];
    setSelectedRoles(selected);

    const allChosen = !!(allPlayers && allPlayers.length > 0 && allPlayers.every((p: any) => p.role_id));
    setAllSelected(allChosen);
  };

  // 初始化玩家角色與已選角色
  useEffect(() => {
    if (characters.length > 0) {
      fetchInitialData();
    }
  }, [playerId, roomId, characters]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}-role-selection`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          // 有玩家角色變動時，重新取得最新選角狀態
          fetchInitialData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, characters]);

  useEffect(() => {
    if (!allSelected) return;
  
    const sendSystemMessage = async () => {
      // 檢查是否已經有類似訊息，避免重複發送
      const { data: messages } = await supabase
        .from('message')
        .select()
        .eq('room_id', roomId)
        .eq('sender_id', SYSTEM_USER_ID)
        .eq('content', '所有玩家已選擇角色，請輪流自我介紹')
        .limit(1);
  
      if (!messages || messages.length === 0) {
        const { error } = await supabase.from('message').insert([
          {
            room_id: roomId,
            sender_id: SYSTEM_USER_ID,
            receiver_id: null,
            content: '所有玩家已選擇角色，請輪流自我介紹',
          },
        ]);
        if (error) console.error('發送系統訊息失敗:', error);
      }
    };
  
    sendSystemMessage();
  }, [allSelected, roomId]);


  const handleSelectCharacter = async (game_role: GameRole) => {
    if (selectedRoles.includes(game_role.name)) return; // 前端先擋一次
  
    // 再次查詢角色是否已被選（避免 race condition）
    const { data: existing, error: checkError } = await supabase
      .from('player')
      .select('id')
      .eq('room_id', roomId)
      .eq('role_id', game_role.id)
      .maybeSingle();
  
    if (checkError) {
      console.error('檢查角色是否已被選取失敗：', checkError);
      return;
    }
  
    if (existing) {
      alert('該角色已被其他玩家選取，請選擇其他角色');
      return;
    }
  
    // 更新玩家角色
    const { error: updateError } = await supabase
      .from('player')
      .update({ role_id: game_role.id })
      .eq('id', playerId);
  
    if (updateError) {
      console.error('角色更新失敗：', updateError);
      return;
    }
  
    // 更新前端狀態
    setPlayerInfo(game_role);
    setSelectedRoles((prev) => [...prev, game_role.id]);
  
    // 傳送系統訊息
    const { data: player, error: fetchError } = await supabase
      .from('player')
      .select('name')
      .eq('id', playerId)
      .single();
  
    if (fetchError) {
      console.error('查詢玩家名稱失敗:', fetchError);
      return;
    }
  
    const { error: messageError } = await supabase.from('message').insert([
      {
        room_id: roomId,
        sender_id: SYSTEM_USER_ID,
        receiver_id: null,
        content: `${player?.name} 已選擇角色 ${game_role.name}`,
      },
    ]);
  
    if (messageError) {
      console.error('發送系統訊息失敗：', messageError);
    }
  };
  

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      <h3 className="text-xl font-bold mb-3">角色選擇階段</h3>

      {!playerInfo ? (
        <>
          <p className="mb-4">請選擇你的角色。</p>
          <div className="grid grid-cols-2 gap-4">
            {characters.map((game_role, index) => {
              const isTaken = selectedRoles.includes(game_role.id);
              return (
                <button
                  key={index}
                  disabled={isTaken}
                  className={`p-4 rounded border ${
                    isTaken
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => handleSelectCharacter(game_role)}
                >
                  <h4 className="font-semibold">{game_role.name}</h4>
                  <p className="text-sm text-gray-600">{game_role.name}</p>
                  {isTaken && <p className="text-red-500 mt-2">已被選擇</p>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-6">
          <h4 className="font-semibold mb-2">你的角色：{playerInfo.name}</h4>
          <div className="bg-blue-50 p-3 rounded border border-blue-100">
            <p>
              <span className="font-medium">公開信息：</span>{' '}
              {playerInfo.public_info}
            </p>

            {playerInfo.secret && (
              <p className="mt-2">
                <span className="font-medium text-red-600">秘密：</span>{' '}
                {playerInfo.secret}
              </p>
            )}

            {playerInfo.mission && (
              <p className="mt-2">
                <span className="font-medium text-green-600">任務：</span>{' '}
                {playerInfo.mission}
              </p>
            )}
          </div>
        </div>
      )}

      {/* {playerInfo && isHost && allSelected &&(
        <div className="mt-6 text-center">
          <button className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => setCurrentPhase('role_selection')}
          >下一步</button>
        </div>
      )} */}
      {isHost &&(
        <div className="mt-6 text-center">
          <button className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => setCurrentPhase('role_selection')}
          >下一步</button>
        </div>
      )}
      </div>
      );
    };