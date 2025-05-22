import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { playerId, roomId } = await request.json();

    console.log('收到玩家退出請求：', { playerId, roomId });

    if (!playerId || !roomId) {
      console.error('缺少參數：', { playerId, roomId });
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 獲取玩家信息用於系統消息
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('nickname')
      .eq('id', playerId)
      .single();

    if (playerError) {
      console.error('獲取玩家信息失敗：', playerError);
    }

    if (player) {
      console.log('發送玩家離開消息：', player.nickname);
      
      // 添加系統消息
      const { error: messageError } = await supabase.from('messages').insert([
        {
          room_id: roomId,
          sender_id: 'system',
          receiver_id: 'system',
          content: `${player.nickname} 離開了房間`,
        },
      ]);

      if (messageError) {
        console.error('發送系統消息失敗：', messageError);
      }
    }

    // 刪除玩家
    console.log('刪除玩家：', playerId);
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId);

    if (deleteError) {
      console.error('刪除玩家錯誤:', deleteError);
      return NextResponse.json({ error: '刪除玩家失敗' }, { status: 500 });
    }

    console.log('玩家成功退出：', playerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('處理退出請求錯誤:', error);
    return NextResponse.json({ error: '處理退出請求失敗' }, { status: 500 });
  }
} 