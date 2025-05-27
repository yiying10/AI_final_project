export interface ChatRequest {
    text: string;
    model?: string;
    temperature?: number;
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
   * @param gameId 遊戲 ID
   * @param playerId 玩家 ID
   * @param npcId NPC ID
   * @param body 請求內容：玩家說的話、模型、溫度
   * @returns NPC 的對話與可能的線索、證據
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
  