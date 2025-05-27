'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Role {
  id: string;
  name: string;
  public_info: string;
  secret: string;
  mission: string;
  dialogue1: string;
  dialogue2: string;
}

interface Props {
  roomId: string;
  playerId: string;
  isHost: boolean;
  currentPhase: string;
  setCurrentPhase: () => void;
}

const DialoguePhase = ({ roomId, playerId, isHost, setCurrentPhase, currentPhase }: Props) => {
  const [role, setRole] = useState<Role | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [playersInRoom, setPlayersInRoom] = useState<string[]>([]);

  // 取得自己角色
  useEffect(() => {
    const fetchRole = async () => {
      const { data: playerData } = await supabase
        .from('player')
        .select('role_id')
        .eq('id', playerId)
        .single();

      const { data: roleData } = await supabase
        .from('gamerole')
        .select('*')
        .eq('id', playerData?.role_id)
        .single();

      setRole(roleData);
    };

    fetchRole();
  }, [playerId]);

  // 載入玩家列表
  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('player')
        .select('id')
        .eq('room_id', roomId);
      setPlayersInRoom(data?.map(p => p.id) || []);
    };

    fetchPlayers();
  }, [roomId]);

//   // 訂閱確認事件
//   useEffect(() => {
//     const channel = supabase.channel(`confirm-phase-${roomId}`).on(
//       'broadcast',
//       { event: 'confirmed' },
//       (payload) => {
//         const id = payload.payload.playerId;
//         setConfirmedIds(prev => prev.includes(id) ? prev : [...prev, id]);
//       }
//     ).subscribe();

//     return () => {
//       supabase.removeChannel(channel);
//     };
//   }, [roomId]);

//   // 房主檢查是否全部人都確認
//   useEffect(() => {
//     if (isHost) {
//       setCurrentPhase();
//     }
//   }, [confirmedIds, playersInRoom, isHost]);

//   const handleConfirm = () => {
//     supabase.channel(`confirm-phase-${roomId}`).send({
//       type: 'broadcast',
//       event: 'confirmed',
//       payload: { playerId },
//     });
//     setConfirmedIds(prev => prev.includes(playerId) ? prev : [...prev, playerId]);
//   };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-lg border border-gray-200 space-y-4">
  <div>
    <h2 className="text-2xl font-bold text-indigo-700 mb-2">角色劇本閱讀</h2>
    <p className="text-gray-700">請先仔細閱讀自己的角色資訊，並在所有人準備好後，輪流進行自我介紹。房主負責點擊「下一步」進入下一階段。</p>
  </div>

  <hr className="my-4 border-gray-300" />

  {role ? (
    <div className="space-y-2">
      <p><strong className="text-indigo-600">你的名字：</strong><span className="text-gray-800">{role.name}</span></p>
      <p><strong className="text-indigo-600">公開資訊：</strong><span className="text-gray-800">{role.public_info}</span></p>
      <p><strong className="text-indigo-600">秘密：</strong><span className="text-gray-800">{role.secret}</span></p>
      <p><strong className="text-indigo-600">任務：</strong><span className="text-gray-800">{role.mission}</span></p>

      {(currentPhase === 'dialogue1') && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg mt-4">
          <p><strong className="text-indigo-700">劇本一：</strong>{role.dialogue1}</p>
        </div>
      )}

      {(currentPhase === 'dialogue2') && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg mt-4">
          <p><strong className="text-indigo-700">劇本二：</strong>{role.dialogue2}</p>
        </div>
      )}

      {isHost && (currentPhase === 'dialogue1') && (
        <button
          className="mt-6 w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition"
          onClick={setCurrentPhase}>
          所有人已完成自我介紹，前往案發現場！
        </button>
      )}

      {isHost && (currentPhase === 'dialogue2') && (
        <button
          className="mt-6 w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition"
          onClick={setCurrentPhase}>
          所有人已閱讀完角色劇本，再度前往現場探勘！
        </button>
      )}
    </div>
  ) : (
    <p className="text-gray-500">載入角色資料中...</p>
  )}
  {/* debug用 */}
  {isHost &&(
        <button
          className="mt-6 w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition"
          onClick={setCurrentPhase}>
          跳過
        </button>
      )}
</div>

  );
};

export default DialoguePhase;
