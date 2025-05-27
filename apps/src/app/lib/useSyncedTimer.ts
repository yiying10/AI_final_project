import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UseSyncedTimerOptions {
  roomId: string;
  phase: string;
  isHost: boolean;
  duration: number; // 倒數時間（秒）
  onTimerEnd?: () => void;
}

export function useSyncedTimer({
  roomId,
  phase,
  isHost,
  duration,
  onTimerEnd,
}: UseSyncedTimerOptions) {
  const [timer, setTimer] = useState<number>(duration);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const initTimer = async () => {
      // 1️⃣ 房主設定開始時間
      if (isHost) {
        const { error } = await supabase
          .from('room')
          .update({ timer_start_at: new Date().toISOString() })
          .eq('id', roomId);
        if (error) {
          console.error('設定 timer_start_at 失敗:', error);
        }
      }

      // 2️⃣ 所有玩家讀取並計算剩餘時間
      const { data: roomData, error } = await supabase
        .from('room')
        .select('timer_start_at')
        .eq('id', roomId)
        .single();

      if (error || !roomData?.timer_start_at) {
        console.error('讀取 timer_start_at 失敗:', error);
        return;
      }

      const startTime = new Date(roomData.timer_start_at).getTime();
      const endTime = startTime + duration * 1000;

      interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimer(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          if (isHost && onTimerEnd) onTimerEnd();
        }
      }, 1000);
    };

    if (phase === 'discussion1' || phase === 'discussion2' || phase === 'investigation1' || phase === 'investigation2') {
      initTimer();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, roomId, isHost, duration, onTimerEnd]);

  return timer;
}
