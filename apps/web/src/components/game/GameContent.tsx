import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { GameScript } from '@/lib/storyGenerator';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface GameContentProps {
  roomId: string;
  playerId: string;
  playerRole: string;
  gameScript: GameScript;
}

interface RoomUpdate {
  current_phase: string;
  [key: string]: any;
}

export default function GameContent({
  roomId,
  playerId,
  playerRole,
  gameScript,
}: GameContentProps) {
  const [currentPhase, setCurrentPhase] = useState<string>('introduction');
  const [timer, setTimer] = useState<number>(300); // 5分鐘倒計時
  const [playerInfo, setPlayerInfo] = useState<any>(null);
  const [discoveredClues, setDiscoveredClues] = useState<string[]>([]);

  useEffect(() => {
    // 獲取玩家角色信息
    const character = gameScript.characters.find((c: { role: string }) => c.role === playerRole);
    if (character) {
      setPlayerInfo(character);
    }

    // 訂閱房間狀態變化
    const roomSubscription = supabase
      .channel(`room:${roomId}`)
      .on<RoomUpdate>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<RoomUpdate>) => {
          if (payload.new && payload.new.current_phase) {
            setCurrentPhase(payload.new.current_phase);
          }
        }
      )
      .subscribe();

    return () => {
      roomSubscription.unsubscribe();
    };
  }, [roomId, playerRole, gameScript]);

  // 倒計時邏輯
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

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

  // 渲染當前階段的內容
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'introduction':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold">故事背景</h3>
            <p className="text-gray-700">{gameScript.background}</p>
            <div className="bg-gray-100 p-4 rounded-lg">
              <h4 className="font-bold">你的角色信息</h4>
              {playerInfo && (
                <>
                  <p>角色：{playerInfo.name} ({playerInfo.role})</p>
                  <p>公開信息：{playerInfo.public_info}</p>
                  <p className="text-red-600">秘密：{playerInfo.secret}</p>
                  <p className="text-blue-600">任務：{playerInfo.mission}</p>
                </>
              )}
            </div>
          </div>
        );

      case 'investigation':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold">調查階段</h3>
            <p>剩餘時間：{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
            <div className="grid grid-cols-2 gap-4">
              {gameScript.clues.map((clue, index) => (
                <button
                  key={index}
                  onClick={() => handleDiscoverClue(clue)}
                  className={`p-4 border rounded ${
                    discoveredClues.includes(clue)
                      ? 'bg-green-100 border-green-500'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {discoveredClues.includes(clue) ? clue : '???'}
                </button>
              ))}
            </div>
          </div>
        );

      case 'discussion':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold">討論階段</h3>
            <p>剩餘時間：{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
            <div className="bg-gray-100 p-4 rounded-lg">
              <h4 className="font-bold">已發現的線索</h4>
              <ul className="list-disc pl-5">
                {discoveredClues.map((clue, index) => (
                  <li key={index}>{clue}</li>
                ))}
              </ul>
            </div>
          </div>
        );

      case 'voting':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold">投票階段</h3>
            <p>請選擇你認為的兇手...</p>
            {/* 投票界面將在後續實現 */}
          </div>
        );

      default:
        return <div>等待遊戲開始...</div>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{gameScript.title}</h2>
        <p className="text-gray-600">{gameScript.scene}</p>
      </div>
      {renderPhaseContent()}
    </div>
  );
} 