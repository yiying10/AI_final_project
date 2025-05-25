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
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

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
      .channel(`room-${roomId}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
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
      messageChannel.unsubscribe();
    };
  }, [roomId]);

  // 初始載入與訂閱玩家列表
  useEffect(() => {
    let isMounted = true;

    async function fetchPlayers() {
      const { data, error } = await supabase
        .from('players')
        .select('id, nickname')
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
      .channel(`room-${roomId}-players`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        () => fetchPlayers()
      )
      .subscribe();

    return () => {
      isMounted = false;
      playerChannel.unsubscribe();
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

    const { error } = await supabase.from('messages').insert([
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
      : players.find((p) => p.id === selectedReceiverId)?.nickname || '私聊';

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

      <div className="flex flex-col flex-1">
        <div className="bg-white p-3 border-b">{receiverName}</div>
        <div className="flex-1 p-3 overflow-y-auto space-y-2" id="chat-messages">
          {filteredMessages.map((m) => {
            const sender = players.find((p) => p.id === m.sender_id);
            const isSystemMessage = m.receiver_id === null;

            return (
              <div
                key={m.id}
                className={`p-2 rounded max-w-[90%] ${
                  isSystemMessage
                    ? 'bg-gray-100 text-center mx-auto text-gray-500 text-sm border border-gray-200'
                    : m.sender_id === playerId
                    ? 'bg-blue-200 self-end ml-auto'
                    : 'bg-gray-200'
                }`}
              >
                {!isSystemMessage && (
                  <div className="text-xs text-gray-500 mb-1">
                    {sender ? sender.nickname : m.sender_id === playerId ? '你' : '未知'}
                  </div>
                )}
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
