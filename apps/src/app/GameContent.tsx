'use client';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { getGameContent } from './lib/Map';
import {SYSTEM_USER_ID} from './lib/config';
import ChatRoom from "./ChatRoom";

import IntroductionPhase from './phases/IntroductionPhase';
import RoleSelectionPhase from './phases/RoleSelectionPhase';
import InvestigationPhase from './phases/InvestigationPhase';
import DiscussionPhase from './phases/DiscussionPhase';
import VotingPhase from './phases/VotingPhase';
import EndedPhase from './phases/EndedPhase';
import DefaultPhase from './phases/DefaultPhase';

interface GameContentProps {
  roomId: string;
  playerId: string;
  playerRole: string;
}

interface RoomUpdate {
  id: string;
  status: string;
}

export default function GameContent({
  roomId,
  playerId,
  playerRole,
}: GameContentProps) {
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState<string>('introduction');
  const [timer, setTimer] = useState<number>(300);
  const [playerInfo, setPlayerInfo] = useState<any>(null);
  const [discoveredClues, setDiscoveredClues] = useState<string[]>([]);
  const gameContent = getGameContent();
  const [isHost, setIsHost] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'map' | 'chat'>('map');

  const phaseList = [
    'introduction',
    'role_selection',
    'investigation',
    'discussion',
    'voting',
    'ended',
  ];

  const goToNextPhase = async () => {
    setCurrentPhase((prevPhase) => {
      const currentIndex = phaseList.indexOf(prevPhase);
      if (currentIndex !== -1 && currentIndex < phaseList.length - 1) {
        const nextPhase = phaseList[currentIndex + 1];
        
        // 更新房間的 status
        supabase
          .from('room')
          .update({ status: nextPhase })
          .eq('id', roomId)
          .then(({ error }) => {
            if (error) {
              console.error('更新房間狀態失敗:', error);
            }
          });
        console.log(`切換到下一階段: ${nextPhase}`);
        return nextPhase;
      }
      return prevPhase; // 如果已經是最後一階段，保持不變
    });
  };

  //角色初始化與訂閱房間狀態
  useEffect(() => {
    const roomChannel = supabase
      .channel(`room:id=eq.${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room', filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.new && payload.new.status) {
          setCurrentPhase(payload.new.status);
        }
      })
      .subscribe();

    if (playerInfo) {
      setCurrentPhase('role_selection');
    }

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, playerRole, playerInfo]);

  //訂閱訊息
  useEffect(() => {
    const messageChannel = supabase
      .channel(`message:room_id=eq.${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message', filter: `room_id=eq.${roomId}` }, (payload) => {
        console.log('新訊息:', payload.new);
        // 你可以在這裡更新訊息列表或顯示通知
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [roomId]);
  
  //檢查房主
  useEffect(() => {
    const fetchIsHost = async () => {
      const { data, error } = await supabase
        .from('player')
        .select('id, is_host')
        .eq('room_id', roomId);
  
      if (!error && data) {
        const currentPlayer = data.find((p) => p.id === playerId);
        setIsHost(currentPlayer?.is_host || false);
      } else {
        console.error('檢查房主狀態失敗:', error);
      }
    };
  
    fetchIsHost();
  }, [roomId, playerId]);

  // 確保刷新時保持當前階段
  useEffect(() => {
    const fetchRoomStatus = async () => {
      const { data: room, error } = await supabase
        .from('room')
        .select('status')
        .eq('id', roomId)
        .single();

      if (!error && room) {
        setCurrentPhase(room.status);
      } else {
        console.error('獲取房間狀態失敗:', error);
      }
    };

    fetchRoomStatus();
  }, [roomId]);
  

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'introduction':
        return (
          <IntroductionPhase
            isHost={isHost}
            roomId={roomId}
            playerId={playerId}
            setCurrentPhase={goToNextPhase} // 使用通用函式
          />
        );

      case 'role_selection':
        return (
          <RoleSelectionPhase
            playerId={playerId}
            roomId={roomId}
            isHost={isHost}
            currentPhase ={currentPhase}
            setCurrentPhase={goToNextPhase} 
          />
        );

      case 'investigation':
        return <InvestigationPhase
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          timer={timer}
          setTimer={setTimer}
          discoveredClues={discoveredClues}
          setDiscoveredClues={setDiscoveredClues}
          gameContent={gameContent}
          roomId={roomId}
          playerId={playerId}
          setCurrentPhase={goToNextPhase} // 使用通用函式
         />;

      case 'discussion':
        return <DiscussionPhase 
        roomId={roomId}
        setTimer={setTimer}
        timer={timer}
        setCurrentPhase={goToNextPhase} // 使用通用函式
        />;

      case 'voting':
        return (
          <VotingPhase
            playerId={playerId}
            roomId={roomId}
            setCurrentPhase={goToNextPhase} // 使用通用函式
          />
        );

      case 'ended':
        return <EndedPhase />;

      default:
        return <DefaultPhase />;
    }
  };

  return (
    <div className="my-6">
      {renderPhaseContent()}
    </div>
  );
}