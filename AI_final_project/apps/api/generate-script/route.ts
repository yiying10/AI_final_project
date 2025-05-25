import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const res = await fetch(
    `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.functions.supabase.co/generate-script`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 如果需要 service_role，可用： Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`
      },
      body: await req.text() // 直接把前端傳來的 body 轉給 Edge Function
    }
  );

  if (!res.ok) {
    return new Response('Edge Function error', { status: 500 });
  }

  const data = await res.json();
  return Response.json(data);
}
