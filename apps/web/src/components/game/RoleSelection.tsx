'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

interface Character {
  name: string;
  role: string;
  public_info: string;
  secret?: string;
  mission?: string;
}

interface RoleSelectionProps {
  roomId: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
  gameScript: any;
  onRoleSelected: (role: string) => void;
}

export default function RoleSelection({
  roomId,
  playerId,
  playerName,
  isHost,
  gameScript,
  onRoleSelected,
}: RoleSelectionProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [myRole, setMyRole] = useState<string | null>(null);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // 載入角色列表
  useEffect(() => {
    if (gameScript && gameScript.characters) {
      setCharacters(gameScript.characters);
    }
  }, [gameScript]);

  // 訂閱玩家角色選擇狀態
  useEffect(() => {
    async function loadSelectedRoles() {
      const { data: players } = await supabase
        .from('players')
        .select('id, nickname, role')
        .eq('room_id', roomId);

      if (players) {
        const roleMap: Record<string, string> = {};
        let readyCount = 0;

        players.forEach(player => {
          if (player.role) {
            roleMap[player.role] = player.nickname;
            readyCount++;
          }
          
          // 檢查自己的角色
          if (player.id === playerId && player.role) {
            setMyRole(player.role);
          }
        });

        setSelectedRoles(roleMap);
        setAllPlayersReady(readyCount === players.length && players.length >= 4);
        setPlayerCount(players.length);
      }
    }

    loadSelectedRoles();

    // 訂閱玩家變化
    const playerChannel = supabase
      .channel(`room-${roomId}-players-roles`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        () => loadSelectedRoles()
      )
      .subscribe();

    return () => {
      playerChannel.unsubscribe();
    };
  }, [roomId, playerId]);

  // 選擇角色
  async function selectRole(role: string) {
    if (myRole || selectedRoles[role]) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ role: role })
        .eq('id', playerId);

      if (error) throw error;

      setMyRole(role);
      
      // 發送系統消息
      await supabase.from('messages').insert([
        {
          room_id: roomId,
          sender_id: 'system',
          receiver_id: 'system',
          content: `${playerName} 選擇了角色 ${characters.find(c => c.role === role)?.name || role}`,
        },
      ]);

      onRoleSelected(role);
      toast.success('角色選擇成功！');
    } catch (error) {
      console.error('選擇角色失敗:', error);
      toast.error('選擇角色失敗，請重試');
    } finally {
      setLoading(false);
    }
  }

  // 開始遊戲
  async function startGame() {
    if (!isHost || !allPlayersReady) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'introduction' })
        .eq('id', roomId);

      if (error) throw error;
      
      toast.success('遊戲開始！');
    } catch (error) {
      console.error('開始遊戲失敗:', error);
      toast.error('開始遊戲失敗，請重試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="my-6">
      <h3 className="text-xl font-bold mb-4">選擇你的角色</h3>
      
      {myRole ? (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <p className="font-medium text-green-800">
            你已選擇角色：{characters.find(c => c.role === myRole)?.name || myRole}
          </p>
          <p className="text-sm text-green-700 mt-2">
            等待其他玩家選擇角色...
          </p>
        </div>
      ) : (
        <p className="text-gray-600 mb-4">請選擇一個角色：</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {characters.map((character) => {
          const isSelected = !!selectedRoles[character.role];
          const isMyRole = myRole === character.role;
          
          return (
            <div
              key={character.role}
              className={`border rounded-lg p-4 transition-all ${
                isSelected
                  ? isMyRole
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200 opacity-70'
                  : 'hover:border-blue-300 cursor-pointer'
              }`}
              onClick={() => !isSelected && !myRole && selectRole(character.role)}
            >
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-lg">{character.name}</h4>
                {isSelected && (
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                    {isMyRole ? '你的角色' : `${selectedRoles[character.role]} 已選擇`}
                  </span>
                )}
              </div>
              <p className="text-sm mt-2">{character.public_info}</p>
              
              {isMyRole && character.secret && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 p-3 rounded">
                  <p className="text-sm font-medium text-yellow-800">秘密信息：</p>
                  <p className="text-sm mt-1">{character.secret}</p>
                </div>
              )}
              
              {isMyRole && character.mission && (
                <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded">
                  <p className="text-sm font-medium text-blue-800">任務：</p>
                  <p className="text-sm mt-1">{character.mission}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isHost && (
        <div className="mt-6 border-t pt-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium">房主控制面板</h4>
              <p className="text-sm text-gray-600">
                {allPlayersReady 
                  ? '所有玩家已選擇角色，可以開始遊戲' 
                  : `等待玩家選擇角色 (${Object.keys(selectedRoles).length}/${playerCount})`}
              </p>
            </div>
            <button
              onClick={startGame}
              disabled={!allPlayersReady || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? '處理中...' : '開始遊戲'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 