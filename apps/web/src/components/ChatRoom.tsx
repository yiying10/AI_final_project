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
}

export default function ChatRoom({ roomId, playerId }: ChatRoomProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>('system');
  const [newMessage, setNewMessage] = useState('');

  // 載入玩家
  useEffect(() => {
    async function fetchPlayers() {
      const { data } = await supabase
        .from('players')
        .select('id, nickname')
        .eq('room_id', roomId);
      if (data) setPlayers(data);
    }
    fetchPlayers();

    const playerChannel = supabase
      .channel(`room-${roomId}-players`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        () => {
          fetchPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playerChannel);
    };
  }, [roomId]);

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
      supabase.removeChannel(messageChannel);
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
          {filteredMessages.map((m) => (
            <div
              key={m.id}
              className={`p-2 rounded max-w-[70%] ${
                m.sender_id === playerId ? 'bg-blue-200 self-end ml-auto' : 'bg-gray-200'
              }`}
            >
              {m.content}
            </div>
          ))}
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
