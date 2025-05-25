import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// 创建管理员客户端，使用服务角色密钥，绕过 RLS
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

export async function POST(request: Request) {
  try {
    const { playerId, roomId } = await request.json();

    console.log('收到玩家退出請求：', { playerId, roomId });

    if (!playerId || !roomId) {
      console.error('缺少參數：', { playerId, roomId });
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 獲取玩家信息用於系統消息
    const { data: player, error: playerError } = await adminSupabase
      .from('players')
      .select('nickname, is_host')
      .eq('id', playerId)
      .single();

    if (playerError) {
      console.error('獲取玩家信息失敗：', playerError);
    }

    const isHost = player?.is_host || false;

    if (player) {
      console.log('發送玩家離開消息：', player.nickname);
      
      // 添加系統消息
      const { error: messageError } = await supabase.from('messages').insert([
        {
          room_id: roomId,
          sender_id: playerId,
          receiver_id: null,
          content: `${player.nickname} 離開了房間`,
        },
      ]);

      if (messageError) {
        console.error('發送系統消息失敗：', messageError);
      }
    }

    // 如果是房主，需要将房主权限转移给其他玩家
    if (isHost) {
      console.log('房主離開，尋找新房主');
      
      // 获取房间内其他玩家，按加入时间排序
      const { data: otherPlayers, error: otherPlayersError } = await adminSupabase
        .from('players')
        .select('id')
        .eq('room_id', roomId)
        .neq('id', playerId)
        .order('joined_at', { ascending: true });
      
      if (otherPlayersError) {
        console.error('獲取其他玩家失敗：', otherPlayersError);
      }
      
      if (otherPlayers && otherPlayers.length > 0) {
        // 选择第一个玩家作为新房主
        const newHostId = otherPlayers[0].id;
        
        console.log('設置新房主：', newHostId);
        
        // 更新新房主
        const { error: updateError } = await adminSupabase
          .from('players')
          .update({ is_host: true })
          .eq('id', newHostId);
        
        if (updateError) {
          console.error('設置新房主失敗：', updateError);
        } else {
          // 发送系统消息通知房主变更
          await supabase.from('messages').insert([
            {
              room_id: roomId,
              sender_id: newHostId,
              receiver_id: null,
              content: `房主已變更`,
            },
          ]);
        }
      } else {
        console.log('房間內無其他玩家，不需要轉移房主權限');
      }
    }

    // 刪除玩家
    console.log('刪除玩家：', playerId);
    const { error: deleteError } = await adminSupabase
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