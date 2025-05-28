import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UseSyncedTimerOptions {
  roomId: string;
  phase: string;
  isHost: boolean;
  duration: number; // 倒數時間（秒）
  onTimerEnd?: () => void;
}

type TimerField = 'timer_start_at' | 'timer2_start_at' | 'timer3_start_at' | 'timer4_start_at';

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
      try {
        let timerField: TimerField | null = null;

        // 決定使用哪個欄位
        if (phase.startsWith('discussion1')) {
          timerField = 'timer2_start_at';
        } else if (phase.startsWith('investigation1')) {
          timerField = 'timer_start_at';
        }
        else if (phase.startsWith('discussion2')) {
          timerField = 'timer3_start_at';
        } else if (phase.startsWith('investigation2')) {
          timerField = 'timer4_start_at';
        }

        if (!timerField) {
          console.log(`階段 ${phase} 不需要計時器`);
          setTimer(duration);
          return;
        }

        // 嘗試讀取 timer 開始時間
        const { data: roomData, error: fetchError } = await supabase
          .from('room')
          .select(timerField)
          .eq('id', roomId)
          .single();

        if (fetchError) {
          console.error(`讀取 ${timerField} 失敗:`, fetchError);
          return;
        }

        let timerStartAt = (roomData as Record<string, any>)?.[timerField];

        // 房主負責設置開始時間 (只設一次)
        if (isHost && !timerStartAt) {
          const now = new Date().toISOString();
          const { error: updateError } = await supabase
            .from('room')
            .update({ [timerField]: now })
            .eq('id', roomId);

          if (updateError) {
            console.error(`設定 ${timerField} 失敗:`, updateError);
            return;
          }

          timerStartAt = now;
        }

        if (!timerStartAt) {
          console.error(`${timerField} 尚未設定`);
          return;
        }

        const startTime = new Date(timerStartAt).getTime();
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
      } catch (err) {
        console.error('初始化計時器時發生錯誤:', err);
      }
    };

    if (['discussion1', 'discussion2', 'investigation1', 'investigation2'].includes(phase)) {
      initTimer();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, roomId, isHost, duration, onTimerEnd]);

  return timer;
}
