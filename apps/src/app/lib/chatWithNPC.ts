export interface ChatRequest {
  text: string;
  model?: string;
  temperature?: number;
  unlockable_objects?: Array<{
    id: string;
    name: string;
    content: string | null;
    location_name: string;
  }>;
  // 新增：需要從前端傳給後端的資料
  background: string;
  npc_info: {
    name: string;
    description: string;
    secret?: string;
    mission?: string;
  };
  chat_history?: Array<{
    role: string; // 'user' | 'assistant'
    content: string;
  }>;
}

export interface ChatResponse {
  dialogue: string;
  hint?: string;
  evidence?: {
    id: number;
    name: string;
    description: string;
  } | null;
}

/**
 * 發送對話請求給 NPC
 */
export async function chatWithNPC(
  gameId: number,
  playerId: string,
  npcId: string,
  body: ChatRequest
): Promise<ChatResponse> {
  const response = await fetch(
    `http://127.0.0.1:8000/api/games/${gameId}/players/${playerId}/chat/${npcId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: body.text,
        model: body.model || 'gemini-2.0-flash',
        temperature: body.temperature ?? 0.7,
        unlockable_objects: body.unlockable_objects || [],
        background: body.background,
        npc_info: body.npc_info,
        chat_history: body.chat_history || [],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('API Error:', errorData);
    throw new Error(`Chat API failed: ${response.statusText}`);
  }

  const data: ChatResponse = await response.json();
  return data;
}