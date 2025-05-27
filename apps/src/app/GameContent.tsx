'use client';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { useRouter } from 'next/navigation';
import ChatRoom from "./ChatRoom";

import IntroductionPhase from './phases/IntroductionPhase';
import RoleSelectionPhase from './phases/RoleSelectionPhase';
import InvestigationPhase from './phases/InvestigationPhase';
import DiscussionPhase from './phases/DiscussionPhase';
import VotingPhase from './phases/VotingPhase';
import EndedPhase from './phases/EndedPhase';
import DefaultPhase from './phases/DefaultPhase';
import DialoguePhase from './phases/DialoguePhase';

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
  const [isHost, setIsHost] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'map' | 'chat'>('map');
  const [roomCode, setRoomCode] = useState<number>(0);

  const phaseList = [
    'introduction',
    'role_selection',
    'dialogue1',
    'investigation1',
    'discussion1',
    'dialogue2',
    'investigation2',
    'discussion2',
    'voting',
    'ended',
  ];
  useEffect(() => {
    const fetchRoomCode = async () => {
      const { data, error } = await supabase
        .from('room')
        .select('room_code')
        .eq('id', roomId)
        .single();
  
      if (!error && data) {
        setRoomCode(data.room_code);
      } else {
        console.error('獲取 room_code 失敗:', error);
      }
    };
  
    fetchRoomCode();
  }, [roomId]);

  const goToNextPhase = async () => {
    if (!isHost) return;
    const currentIndex = phaseList.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex >= phaseList.length - 1) {
      console.log('已經是最後一階段或找不到目前階段');
      return;
    }

    const nextPhase = phaseList[currentIndex + 1];

    // 更新 Supabase 房間狀態
    const { error } = await supabase
      .from('room')
      .update({ status: nextPhase })
      .eq('id', roomId);  
    
    if (error) {
      console.error('更新房間狀態失敗:', error);
      return;
    }
  
    // 更新本地狀態
    if(isHost) setCurrentPhase(nextPhase);
    console.log(`切換到下一階段: ${nextPhase}`);
  };
  

  useEffect(() => {
    const roomChannel = supabase
      .channel(`room:id=eq.${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room', filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.new && payload.new.status) {
          setCurrentPhase(payload.new.status);
        }
      })
      .subscribe();
  
    return () => {
      supabase.removeChannel(roomChannel);
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
            roomCode={roomCode}
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
      case 'dialogue1':
        return (
          <DialoguePhase
            playerId={playerId}
            roomId={roomId}
            isHost={isHost}
            currentPhase={currentPhase}
            setCurrentPhase={goToNextPhase} // 使用通用函式
          />
        );

      case 'investigation1':
        return <InvestigationPhase
          roomId={roomId}
          roomCode={roomCode}
          playerId={playerId}
          currentPhase={currentPhase}
          setCurrentPhase={goToNextPhase} // 使用通用函式
         />;

      case 'discussion1':
        return <DiscussionPhase 
        roomId={roomId}
        currentPhase={currentPhase}
        setCurrentPhase={goToNextPhase} // 使用通用函式
        />;
        case 'dialogue2':
          return (
            <DialoguePhase
              playerId={playerId}
              roomId={roomId}
              isHost={isHost}
              currentPhase={currentPhase}
              setCurrentPhase={goToNextPhase} // 使用通用函式
            />
          );
  
        case 'investigation2':
          return <InvestigationPhase
            roomId={roomId}
            roomCode={roomCode}
            playerId={playerId}
            currentPhase={currentPhase}
            setCurrentPhase={goToNextPhase} // 使用通用函式
           />;
  
        case 'discussion2':
          return <DiscussionPhase 
          roomId={roomId}
          currentPhase={currentPhase}
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