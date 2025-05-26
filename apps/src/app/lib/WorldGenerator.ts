import { supabase } from './supabaseClient';

export const generateWorld = async (roomId: string) => {
  try {
    const response = await fetch('/backend/app/routers/world_gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId }),
    });

    if (!response.ok) {
      throw new Error(`後端錯誤：${response.statusText}`);
    }

    const data = await response.json();

    // 將生成的內容存到資料庫
    const { error } = await supabase
      .from('world_data')
      .insert({ room_id: roomId, ...data });

    if (error) {
      throw new Error(`儲存世界內容失敗：${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('生成世界內容失敗：', error);
    throw error;
  }
};
