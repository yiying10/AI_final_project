'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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

  // 根據當前階段顯示不同內容
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'introduction':
        return (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-xl font-bold mb-3">案件背景</h3>
            <p className="mb-4">{gameScript.background}</p>
            
            {playerInfo && (
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
            
            <div className="mt-6">
              <h4 className="font-semibold mb-2">遊戲流程</h4>
              <ol className="list-decimal pl-5 space-y-1">
                {gameScript.flow.map((step: string, index: number) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        );
        
      case 'investigation':
        return (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-xl font-bold mb-3">調查階段</h3>
            <p className="mb-4">尋找線索，調查案發現場。</p>
            
            <div className="flex justify-between items-center mb-4">
              <div>剩餘時間：{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</div>
            </div>
            
            <div className="mt-4">
              <h4 className="font-semibold mb-2">發現的線索</h4>
              {discoveredClues.length > 0 ? (
                <ul className="list-disc pl-5">
                  {discoveredClues.map((clue, index) => (
                    <li key={index} className="mb-1">{clue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">尚未發現任何線索</p>
              )}
            </div>
          </div>
        );
        
      case 'discussion':
        return (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-xl font-bold mb-3">討論階段</h3>
            <p>與其他玩家討論案件，分享線索，找出兇手。</p>
            
            {playerInfo && playerInfo.role === 'murderer' && (
              <div className="mt-4 bg-red-50 p-3 rounded border border-red-200">
                <p className="font-medium text-red-700">你是兇手！請隱藏自己的身份，混淆視聽。</p>
              </div>
            )}
            
            {playerInfo && playerInfo.role === 'detective' && (
              <div className="mt-4 bg-blue-50 p-3 rounded border border-blue-200">
                <p className="font-medium text-blue-700">你是偵探！仔細分析線索，找出兇手。</p>
              </div>
            )}
          </div>
        );
        
      case 'voting':
        return (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-xl font-bold mb-3">投票階段</h3>
            <p>根據討論結果，投票選出你認為的兇手。</p>
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