'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Player, Character } from '@/types';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

interface RoleSelectionPhaseProps {
  playerId: string;
  roomId: string;
  isHost: boolean;
  setCurrentPhase: (phase: string) => void;
  currentPhase: string;
}

export default function RoleSelectionPhase({
  playerId,
  roomId,
  isHost,
  setCurrentPhase,
  currentPhase,
}: RoleSelectionPhaseProps) {
  const [playerInfo, setPlayerInfo] = useState<Character | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]); // 劇本角色列表
  const [allSelected, setAllSelected] = useState(false);


  // 載入劇本角色
  useEffect(() => {
    const fetchScript = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('script:script_id(characters)')
        .eq('id', roomId)
        .single();

      if (error || !data?.script?.characters) {
        console.error('讀取劇本失敗:', error);
        return;
      }

      setCharacters(data.script.characters);
    };

    fetchScript();
  }, [roomId]);

  const fetchInitialData = async () => {
    const [{ data: playerData }, { data: allPlayers }] = await Promise.all([
      supabase.from('players').select('role').eq('id', playerId).single(),
      supabase.from('players').select('role').eq('room_id', roomId),
    ]);

    if (playerData?.role) {
      const selected = characters.find((c) => c.role === playerData.role);
      if (selected) setPlayerInfo(selected);
    }

    const selected = allPlayers?.map((p: any) => p.role).filter(Boolean) || [];
    setSelectedRoles(selected);

    const allChosen = allPlayers.length > 0 && allPlayers.every((p: any) => p.role);
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
          table: 'players',
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
        .from('messages')
        .select()
        .eq('room_id', roomId)
        .eq('sender_id', SYSTEM_USER_ID)
        .eq('content', '所有玩家已選擇角色，請輪流自我介紹')
        .limit(1);
  
      if (!messages || messages.length === 0) {
        const { error } = await supabase.from('messages').insert([
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


  const handleSelectCharacter = async (character: Character) => {
    if (selectedRoles.includes(character.role)) return; // 前端先擋一次
  
    // 再次查詢角色是否已被選（避免 race condition）
    const { data: existing, error: checkError } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId)
      .eq('role', character.role)
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
      .from('players')
      .update({ role: character.role })
      .eq('id', playerId);
  
    if (updateError) {
      console.error('角色更新失敗：', updateError);
      return;
    }
  
    // 更新前端狀態
    setPlayerInfo(character);
    setSelectedRoles((prev) => [...prev, character.role]);
  
    // 傳送系統訊息
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('nickname')
      .eq('id', playerId)
      .single();
  
    if (fetchError) {
      console.error('查詢玩家名稱失敗:', fetchError);
      return;
    }
  
    const { error: messageError } = await supabase.from('messages').insert([
      {
        room_id: roomId,
        sender_id: SYSTEM_USER_ID,
        receiver_id: null,
        content: `${player?.nickname} 已選擇角色 ${character.name}`,
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
            {characters.map((character, index) => {
              const isTaken = selectedRoles.includes(character.role);
              return (
                <button
                  key={index}
                  disabled={isTaken}
                  className={`p-4 rounded border ${
                    isTaken
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => handleSelectCharacter(character)}
                >
                  <h4 className="font-semibold">{character.name}</h4>
                  <p className="text-sm text-gray-600">{character.public_info}</p>
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

      {playerInfo && isHost && allSelected &&(
        <div className="mt-6 text-center">
          <button className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => setCurrentPhase('role_selection')}
          >下一步</button>
        </div>
      )}
      </div>
      );
    };