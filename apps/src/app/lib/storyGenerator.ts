import { supabase } from './supabaseClient';
import axios from 'axios';

interface GameRole {
  id: string;
  script_id: string;
  name: string;
  public_info: string;
  secret: string;
  mission: string;
}

export interface GameScript {
  id: string;
  room_id: string;
  prompt: string;
  title: string;
  background: string;
  answer: string;
}

export async function generateStory(roomId: string, prompt: string): Promise<GameScript> {
  try {
    // 呼叫後端以檢查或生成劇本
    await axios.post(`http://localhost:8000/games/${roomId}/background`, { prompt });

    // 從資料庫中檢索劇本
    const { data: existingScript, error: fetchError } = await supabase
      .from('gamescript')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (fetchError) {
      console.error('檢索劇本時出錯：', fetchError);
      throw new Error('無法檢索劇本：' + fetchError.message);
    }

    if (!existingScript) {
      throw new Error('劇本不存在');
    }

    return existingScript;
  } catch (error) {
    console.error('獲取劇本時出錯：', error);
    throw error;
  }
}
