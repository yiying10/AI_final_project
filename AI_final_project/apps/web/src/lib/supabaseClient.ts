import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 確保啟用实时功能
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

/**
 * 傳送系統訊息並跳轉到下一階段
 */
export const endInvestigationPhase = async () => {
  try {
    const { error } = await supabase
      .from('messages') // 假設有一個 messages 表
      .insert([
        {
          content: '調查階段已結束，現在是討論時間',
          type: 'system', // 假設有一個 type 欄位來區分訊息類型
          created_at: new Date().toISOString()
        }
      ])
    if (error) throw error;

    // 觸發跳轉到下一階段的邏輯
    console.log('跳轉到下一階段');
    // 這裡可以加入跳轉邏輯，例如更新資料庫中的階段狀態
  } catch (err) {
    console.error('無法結束調查階段:', err);
  }
};
