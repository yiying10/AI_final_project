export interface ChatRequest {
  game_id: string;
  player_id: string;
  npc_id: string;
  text: string;
  model?: string;
  temperature?: number;
  background: string;
  npc_info: {
    name: string;
    description: string;
  };
  player_info: {  // 新增：玩家角色資訊
    name: string;
    role: string;
    public_info: string;
    secret: string;
    mission: string;
  };
  chat_history?: any[];
}

export interface ChatResponse {
  dialogue: string;
  hint?: string | null;
  evidence?: string | null;  // 改為 string 與後端一致
}

export async function chatWithNPC(
  gameId: string,
  playerId: string,
  npcId: string,
  body: Partial<ChatRequest>
): Promise<ChatResponse> {
  
  // 確保所有必要欄位都有值
  if (!body.text || body.text.trim() === '') {
    throw new Error('對話內容不能為空');
  }

  if (!body.background) {
    throw new Error('遊戲背景不能為空');
  }

  if (!body.npc_info) {
    throw new Error('NPC 資訊不能為空');
  }

  if (!body.player_info) {
    throw new Error('玩家角色資訊不能為空');
  }

  // 構建完整的請求體
  const requestBody: ChatRequest = {
    game_id: gameId,
    player_id: playerId,
    npc_id: npcId,
    text: body.text.trim(),
    model: body.model || 'gemini-2.0-flash',
    temperature: body.temperature ?? 0.7,
    background: body.background,
    npc_info: body.npc_info,
    player_info: body.player_info,  // 新增：玩家角色資訊
    chat_history: body.chat_history || []
  };

  console.log('發送請求到:', 'http://127.0.0.1:8000/api/chat/npc');
  console.log('請求內容:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch('http://127.0.0.1:8000/api/chat/npc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API 錯誤響應:', response.status, errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(`API Error: ${errorData.detail || errorText}`);
      } catch {
        throw new Error(`Chat API failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
    }

    const data: ChatResponse = await response.json();
    console.log('API 成功響應:', data);
    return data;
  } catch (error) {
    console.error('請求失敗:', error);
    throw error;
  }
}
