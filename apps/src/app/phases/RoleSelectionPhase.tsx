'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface RoleSelectionPhaseProps {
  playerId: string;
  roomId: string;
  isHost: boolean;
  setCurrentPhase: () => void;
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
}: RoleSelectionPhaseProps) {
  const [playerInfo, setPlayerInfo] = useState<GameRole | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [characters, setCharacters] = useState<GameRole[]>([]);
  const [allSelected, setAllSelected] = useState(false);

  // 載入劇本角色
  useEffect(() => {
    const fetchScript = async () => {
      const { data: scriptData, error: roomError } = await supabase
        .from('gamescript')
        .select('id')
        .eq('room_id', roomId)
        .single();

      if (roomError || !scriptData?.id) {
        console.error('讀取房間劇本失敗:', roomError);
        return;
      }

      const scriptId = scriptData.id;

      const { data: rolesData, error: rolesError } = await supabase
        .from('gamerole')
        .select('id, script_id, name, public_info, secret, mission')
        .eq('script_id', scriptId);

      if (rolesError || !rolesData) {
        console.error('讀取角色資料失敗:', rolesError);
        return;
      }

      setCharacters(rolesData);
    };

    fetchScript();
  }, [roomId]);

  // 監聽玩家角色選擇情況
  useEffect(() => {
    const fetchAndUpdate = async () => {
      const { data: allPlayers, error } = await supabase
        .from('player')
        .select('id, role_id')
        .eq('room_id', roomId);

      if (error) {
        console.error('獲取玩家列表失敗:', error);
        return;
      }

      if (allPlayers) {
        const selected = allPlayers
          .map((p) => p.role_id)
          .filter((id) => id !== null && id !== undefined);

        setSelectedRoles(selected as string[]);

        const allChosen = allPlayers.every((p) => p.role_id !== null && p.role_id !== undefined);
        setAllSelected(allChosen);

        const currentPlayer = allPlayers.find((p) => p.id === playerId);
        if (currentPlayer?.role_id) {
          const roleInfo = characters.find((c) => c.id === currentPlayer.role_id);
          if (roleInfo) setPlayerInfo(roleInfo);
        }
      }
    };

    fetchAndUpdate();

    const channel = supabase
      .channel(`room-${roomId}-role-selection`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player', filter: `room_id=eq.${roomId}` },
        fetchAndUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId, characters]);

  const handleSelectCharacter = async (game_role: GameRole) => {
    if (selectedRoles.includes(game_role.id)) return;

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

    const { error: updateError } = await supabase
      .from('player')
      .update({ role_id: game_role.id, name: game_role.name,})
      .eq('id', playerId);

    if (updateError) {
      console.error('角色更新失敗：', updateError);
      return;
    }

    setPlayerInfo(game_role);

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
        sender_id: null,
        receiver_id: null,
        content: `${player?.name} 已選擇角色 ${game_role.name}`,
      },
    ]);

    if (messageError) {
      console.error('發送系統訊息失敗：', messageError);
    }
  };

return (
  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-6">
    <h3 className="text-2xl font-bold text-indigo-700">角色選擇階段</h3>

    {!playerInfo ? (
      <>
        <p className="text-gray-700">請選擇你的角色。</p>
        <div className="grid grid-cols-2 gap-4">
          {characters.map((game_role) => {
            const isTaken = selectedRoles.includes(game_role.id);
            return (
              <button
                key={game_role.id}
                disabled={isTaken}
                className={`p-4 rounded-lg border transition ${
                  isTaken
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-50 hover:bg-indigo-100'
                }`}
                onClick={() => handleSelectCharacter(game_role)}
              >
                <h4 className="font-semibold text-indigo-700">{game_role.name}</h4>
                <p className="text-sm text-gray-600">{game_role.public_info}</p>
                {isTaken && <p className="text-xs text-red-500 mt-2">已被選擇</p>}
              </button>
            );
          })}
        </div>
      </>
    ) : (
      <div>
        <h4 className="font-semibold text-indigo-700 mb-2">你的角色是：{playerInfo.name}</h4>
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 space-y-2">
          <p><span className="font-medium text-gray-700">公開信息：</span>{playerInfo.public_info}</p>
          {playerInfo.secret && (
            <p><span className="font-medium text-red-600">秘密：</span>{playerInfo.secret}</p>
          )}
          {playerInfo.mission && (
            <p><span className="font-medium text-green-600">任務：</span>{playerInfo.mission}</p>
          )}
        </div>
      </div>
    )}

    {isHost && allSelected && (
      <div className="text-center">
        <button
          className="w-full py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
          onClick={() => setCurrentPhase()}
        >
          全員角色選擇完畢！下一步
        </button>
      </div>
    )}
    {/* debug用 */}
    {isHost && (
        <div className="mt-6 text-center">
          <button
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => setCurrentPhase()}
          >
            跳過
          </button>
        </div>
      )}
  </div>
);}
