import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string | null;
  created_at: string;
}

interface Player {
  id: string;
  nickname: string;
}

interface ChatRoomProps {
  roomId: string;
  playerId: string;
  onPlayersChange: (players: Player[]) => void;
}

export default function ChatRoom({ roomId, playerId, onPlayersChange }: ChatRoomProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>('system');
  const [newMessage, setNewMessage] = useState('');

  // 載入玩家並設置實時更新
  useEffect(() => {
    // 初始載入玩家列表
    async function fetchPlayers() {
      const { data } = await supabase
        .from('players')
        .select('id, nickname')
        .eq('room_id', roomId);
      
      if (data) {
        console.log('載入的玩家列表：', data);
        setPlayers(data);
        onPlayersChange(data);
      }
    }

    fetchPlayers();

    // 建立實時訂閱 - 確保訂閱所有事件類型
    const playerChannel = supabase
      .channel(`room-${roomId}-players-realtime`)
      .on(
        'postgres_changes',
        { 
          event: '*',  // 監聽所有事件類型
          schema: 'public', 
          table: 'players', 
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          console.log('玩家變更事件：', payload);
          
          // 重新獲取最新的玩家列表
          const { data: updatedPlayers } = await supabase
            .from('players')
            .select('id, nickname')
            .eq('room_id', roomId);
          
          if (updatedPlayers) {
            console.log('更新後的玩家列表：', updatedPlayers);
            setPlayers(updatedPlayers);
            onPlayersChange(updatedPlayers);
            
            // 處理玩家加入/離開消息
            if (payload.eventType === 'INSERT') {
              const newPlayer = payload.new as Player;
              // 發送系統消息
              await supabase.from('messages').insert([
                {
                  room_id: roomId,
                  sender_id: 'system',
                  receiver_id: 'system',
                  content: `${newPlayer.nickname} 加入了房間`,
                },
              ]);
            } 
            else if (payload.eventType === 'DELETE') {
              const oldPlayer = payload.old as Player;
              if (oldPlayer && oldPlayer.nickname) {
                // 發送系統消息
                await supabase.from('messages').insert([
                  {
                    room_id: roomId,
                    sender_id: 'system',
                    receiver_id: 'system',
                    content: `${oldPlayer.nickname} 離開了房間`,
                  },
                ]);
              }
            }
          }
        }
      )
      .subscribe();

    console.log('已設置玩家列表實時訂閱');

    // 清理訂閱
    return () => {
      console.log('清理玩家列表實時訂閱');
      playerChannel.unsubscribe();
    };
  }, [roomId, onPlayersChange]);

  // 處理頁面離開事件
  useEffect(() => {
    // 添加頁面離開處理器
    const handleBeforeUnload = () => {
      // 使用 sendBeacon 發送同步請求
      const data = JSON.stringify({ playerId, roomId });
      navigator.sendBeacon('/api/leave-room', data);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 組件卸載時清理
    return () => {
      console.log('組件卸載，執行離開操作');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // 組件卸載時也刪除玩家（如導航到其他頁面）
      fetch('/api/leave-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, roomId }),
      }).catch(err => console.error('離開房間時出錯：', err));
    };
  }, [playerId, roomId]);

  // 載入與訂閱訊息
  useEffect(() => {
    async function fetchMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at');
      
      if (data) setAllMessages(data);
    }

    fetchMessages();

    const messageChannel = supabase
      .channel(`room-${roomId}-messages`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as Message;
          setAllMessages((prev) => [...prev, msg]);
        }
      )
      .subscribe();

    return () => {
      messageChannel.unsubscribe();
    };
  }, [roomId]);

  const filteredMessages = allMessages.filter((msg) => {
    if (selectedReceiverId === 'system') return msg.receiver_id === 'system';
    if (selectedReceiverId === null) return msg.receiver_id === null;
    return (
      (msg.sender_id === playerId && msg.receiver_id === selectedReceiverId) ||
      (msg.receiver_id === playerId && msg.sender_id === selectedReceiverId)
    );
  });

  async function sendMessage() {
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const nickname = `玩家${randomSuffix}`;

    await supabase.from('messages').insert([
      {
        room_id: roomId,
        sender_id: playerId,
        receiver_id: selectedReceiverId === 'system' ? 'system' : selectedReceiverId,
        content: trimmed,
      },
    ]);

    setNewMessage('');
  }

  const receiverName =
    selectedReceiverId === null
      ? '所有人'
      : selectedReceiverId === 'system'
      ? '系統'
      : players.find((p) => p.id === selectedReceiverId)?.nickname || '私聊';

  return (
    <div className="flex h-[70vh] border rounded overflow-hidden">
      {/* 左側玩家列表 */}
      <div className="w-40 border-r overflow-y-auto bg-gray-100">
        {[
          { id: 'system', label: '系統' },
          { id: null, label: '所有人' },
          ...players
            .filter((p) => p.id !== playerId)
            .map((p) => ({ id: p.id, label: p.nickname })),
        ].map((entry) => {
          const isActive =
            selectedReceiverId === entry.id ||
            (selectedReceiverId === null && entry.id === null);
          return (
            <button
              key={entry.id ?? 'null'}
              onClick={() => setSelectedReceiverId(entry.id)}
              className={`w-full py-2 px-3 text-left hover:bg-gray-200 ${
                isActive ? 'bg-gray-300 font-bold' : ''
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {/* 右側聊天區域 */}
      <div className="flex flex-col flex-1">
        <div className="bg-white p-3 border-b">聊天室：{receiverName}</div>
        <div className="flex-1 p-3 overflow-y-auto space-y-2">
          {filteredMessages.map((m) => {
            const sender = players.find((p) => p.id === m.sender_id);
            return (
              <div
                key={m.id}
                className={`p-2 rounded max-w-[70%] ${
                  m.sender_id === playerId ? 'bg-blue-200 self-end ml-auto' : 'bg-gray-200'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {sender ? sender.nickname : (m.sender_id === playerId ? '你' : '未知')}
                </div>
                {m.content}
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
            placeholder="輸入訊息..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            發送
          </button>
        </div>
      </div>
    </div>
  );
}
