import { useState } from 'react';
import GameMap from './GameMap';

interface InvestigationProps {
  roomId: string;
  playerId: string;
  playerName: string;
  role: string;
  onEvidenceFound: (evidenceId: string) => void;
}

export default function Investigation({
  roomId,
  playerId,
  playerName,
  role,
  onEvidenceFound,
}: InvestigationProps) {
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);

  // 移動到新位置
  async function handleMove(locationId: string) {
    if (!roomId || !playerId) return;

    // 更新玩家位置
    await supabase
      .from('players')
      .update({ current_location: locationId })
      .eq('id', playerId);

    setCurrentLocation(locationId);

    // 發送系統訊息
    await supabase.from('messages').insert([
      {
        room_id: roomId,
        sender_id: playerId,
        receiver_id: null,
        content: `${playerName} 移動到了 ${locationId}`,
      },
    ]);
  }

  // 檢查證物
  async function handleExamine(evidenceId: string) {
    if (!roomId || !playerId) return;

    // 更新證物狀態
    await supabase
      .from('evidence')
      .update({ found: true, found_by: playerId })
      .eq('id', evidenceId);

    onEvidenceFound(evidenceId);

    // 發送系統訊息
    await supabase.from('messages').insert([
      {
        room_id: roomId,
        sender_id: playerId,
        receiver_id: null,
        content: `${playerName} 發現了新的證物！`,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded bg-white">
        <h3 className="text-lg font-semibold mb-2">你的角色：{role}</h3>
        <p className="text-sm text-gray-600">
          你現在在：{currentLocation || '尚未選擇位置'}
        </p>
      </div>

      <GameMap
        locations={locations}
        currentPlayer={playerId}
        onMove={handleMove}
        onExamine={handleExamine}
      />
    </div>
  );
}
