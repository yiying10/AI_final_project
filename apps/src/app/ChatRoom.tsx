import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { RealtimePostgresInsertPayload } from '@supabase/supabase-js'; // 可選加型別

interface Message {
  id: string;
  room_id: string;
  content: string;
  sender_id: string;
  receiver_id: string | null;
  created_at: string;
}

interface Player {
    id: string;
    room_id: string;
    name: string;
    is_host: boolean;
    role_id: string;
  }

interface ChatRoomProps {
  roomId: string;
  playerId: string;
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
}

export default function ChatRoom({ roomId, playerId, players, setPlayers }: ChatRoomProps) {
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  // 初始載入訊息
  useEffect(() => {
    let isMounted = true;
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('message')
        .select('*')
        .eq('room_id', roomId)

      if (error) {
        console.error('讀取訊息失敗:', error);
        return;
      }

      if (isMounted && data) {
        setAllMessages(data);
      }
    }

    fetchMessages();

    const messageChannel = supabase
  .channel(`message-room-${roomId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'message',
      filter: `room_id=eq.${roomId}`,  // ✅ 這行雖然寫著，但實際 filter 不生效
    },
    (payload) => {
      const msg = payload.new as Message;
      setAllMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    }
  )
  .subscribe();


    return () => {
      isMounted = false;
      supabase.removeChannel(messageChannel);
    };
  }, [roomId]);

  // 初始載入與訂閱玩家列表
  useEffect(() => {
    let isMounted = true;

    async function fetchPlayers() {
      const { data, error } = await supabase
        .from('player')
        .select('id, name, room_id, role_id, is_host')
        .eq('room_id', roomId);

      if (error) {
        console.error('獲取玩家列表失敗:', error);
        return;
      }

      if (isMounted && data) {
        setPlayers(data);
      }
    }

    fetchPlayers();

    const playerChannel = supabase
  .channel('my-channel')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'player', filter: `room_id=eq.${roomId}` },
    (payload) => { console.log(payload) }
  )
  .subscribe();

  return () => {
    isMounted = false;
    supabase.removeChannel(playerChannel);
  };
}, [roomId, setPlayers]);

  const filteredMessages = allMessages.filter((msg) => {
    if (selectedReceiverId === null) return msg.receiver_id === null;
    return (
      (msg.sender_id === playerId && msg.receiver_id === selectedReceiverId) ||
      (msg.receiver_id === playerId && msg.sender_id === selectedReceiverId)
    );
  });

  async function sendMessage() {
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    const { error } = await supabase.from('message').insert([
      {
        room_id: roomId,
        sender_id: playerId,
        receiver_id: selectedReceiverId,
        content: trimmed,
      },
    ]);

    if (error) {
      console.error('發送訊息失敗：', error);
    }

    setNewMessage('');
  }

  const receiverName =
    selectedReceiverId === null
      ? '系統/所有人'
      : players.find((p) => p.id === selectedReceiverId)?.name || '私聊';

  // 訊息視窗自動捲到底
  useEffect(() => {
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [filteredMessages]);

  return (
    <div className="flex h-[70vh] border rounded overflow-hidden">
      <div className="w-40 border-r overflow-y-auto bg-gray-100">
        <div className="p-2 text-xs text-gray-500 border-b">房間人數: {players.length}</div>
        {[
          { id: null, label: '大廳' },
          ...players
            .filter((p) => p.id !== playerId)
            .map((p) => ({ id: p.id, label: p.name })),
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

      <div className="flex flex-col flex-1">
        <div className="bg-white p-3 border-b">{receiverName}</div>
        <div className="flex-1 p-3 overflow-y-auto space-y-2" id="chat-messages">
        {filteredMessages.map((m) => {
          const sender = players.find((p) => p.id === m.sender_id);
          const isSystemMessage = m.sender_id === null;
          const isOwnMessage = m.sender_id === playerId;

          let messageClass = '';
          let textClass = '';
          let alignClass = '';
          let widthClass = '';

          if (selectedReceiverId === null) {
            // 大廳邏輯
            if (isSystemMessage) {
              messageClass = 'bg-gray-100 text-center mx-auto text-gray-500 text-sm border border-gray-200';
              widthClass = 'w-full max-w-lg';
              alignClass = 'text-center';
            } else if (isOwnMessage) {
              messageClass = 'bg-blue-200 border border-blue-400';
              widthClass = 'max-w-xs';
              alignClass = 'self-end ml-auto';
            } else {
              messageClass = 'bg-gray-200';
              widthClass = 'max-w-xs';
              alignClass = '';
            }
          } else {
            // 私聊邏輯
            messageClass = isOwnMessage ? 'bg-blue-200 self-end ml-auto' : 'bg-gray-200';
            widthClass = 'max-w-xs';
            alignClass = '';
          }

          return (
            <div key={m.id} className={`p-2 rounded ${widthClass} ${alignClass} ${messageClass}`}>
              {!isSystemMessage && (
                <div className="text-xs text-gray-500 mb-1">
                  {sender ? sender.name : isOwnMessage ? '你' : '未知'}
                </div>
              )}
              <div>{m.content}</div>
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
