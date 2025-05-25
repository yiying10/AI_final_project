import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  // 預留：日後串接 AI 劇本產生邏輯
  return new Response(
    JSON.stringify({ message: 'Hello from generate-script API!' }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
