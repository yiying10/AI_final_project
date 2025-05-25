import { useState, useEffect } from 'react';
import { generateStory } from '@/lib/storyGenerator';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';

interface IntroductionPhaseProps {
  roomId: string;
  playerId: string;
  isHost: boolean;
  setCurrentPhase: (phase: string) => void;
}

export default function IntroductionPhase({ roomId, playerId, isHost, setCurrentPhase }: IntroductionPhaseProps) {
  const [prompt, setPrompt] = useState('');
  const [generatingStory, setGeneratingStory] = useState(false);
  const [storySummary, setStorySummary] = useState<string | null>(null);
  const [scriptPrompt, setScriptPrompt] = useState<string | null>(null);

  // 🚀 通用的劇本載入邏輯
  const loadScriptFromRoom = async () => {
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('script_id')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData?.script_id) return;

    const { data: script, error: scriptError } = await supabase
      .from('game_scripts')
      .select('title, background, prompt')
      .eq('id', roomData.script_id)
      .single();

    if (scriptError || !script) return;

    setStorySummary(`${script.title}\n${script.background}`);
    setScriptPrompt(script.prompt);
  };

  // ✅ 初次載入
  useEffect(() => {
    loadScriptFromRoom();

    // ✅ 實時監聽房間 script_id 變化（即時更新劇本）
    const subscription = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const newScriptId = payload.new.script_id;
          if (newScriptId) {
            loadScriptFromRoom(); // 更新畫面
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [roomId]);

  const handleGenerateStory = async () => {
    if (!prompt.trim()) {
      toast.error('請輸入有效的提示詞');
      alert('請輸入有效的提示詞');
      return;
    }

    setGeneratingStory(true);
    try {
      const newScript = await generateStory(roomId, prompt);
      if (!newScript) throw new Error('生成劇本失敗：未返回劇本數據');

      const { data: insertedScript, error: insertError } = await supabase
        .from('game_scripts')
        .insert({
          title: newScript.title,
          background: newScript.background,
          characters: newScript.characters,
          prompt,
        })
        .select()
        .single();

      if (insertError || !insertedScript) throw new Error('儲存劇本失敗：' + insertError?.message);

      const { error: updateRoomError } = await supabase
        .from('rooms')
        .update({ script_id: insertedScript.id })
        .eq('id', roomId);

      if (updateRoomError) throw new Error('更新房間資料失敗：' + updateRoomError.message);

      toast.success('劇本生成並儲存成功！');
    } catch (error) {
      console.error('生成劇本失敗：', error);
      toast.error(error instanceof Error ? error.message : '生成劇本失敗，請重試');
    } finally {
      setGeneratingStory(false);
    }
  };

  return (
    <div className="bg-gray-100 px-4 py-4 rounded shadow-sm">
      <h2 className="text-2xl font-bold mb-4 text-indigo-700">遊戲介紹</h2>
      <p className="mb-2 text-gray-700">
        歡迎來到劇本殺推理遊戲！你即將與其他玩家一同體驗一段懸疑刺激的故事。每位玩家將扮演一位角色，
        根據劇情中的線索與對話，找出真相，揭開事件背後的謎團。
      </p>
      <p className="mb-4 text-gray-700">
        接下來房主將進入角色選擇階段，請準備好接受你即將扮演的身份！
      </p>

      {scriptPrompt && storySummary && (
        <div className="bg-white border border-indigo-200 p-4 rounded mb-4">
          <p className="text-sm text-gray-500 mb-1">Prompt：</p>
          <p className="mb-4 font-medium text-indigo-900 whitespace-pre-line">{scriptPrompt}</p>
          <h3 className="text-lg font-bold text-indigo-800 mb-2">故事背景</h3>
          <p className="text-gray-800 whitespace-pre-line">{storySummary}</p>
        </div>
      )}

      {isHost && (
        <div className="mt-6 bg-white border p-4 rounded shadow-inner">
          <label className="block mb-2 font-semibold text-gray-800">輸入提示詞以生成劇本：</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-2 border rounded mb-4"
            placeholder="例如：一個發生在古堡的謀殺案"
          />
          <button
            onClick={handleGenerateStory}
            disabled={generatingStory}
            className={`px-4 py-2 text-white rounded ${generatingStory ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            {generatingStory ? '生成中...' : '生成劇本'}
          </button>
        </div>
      )}

      {isHost && storySummary && (
        <div className="mt-6">
          <button
            onClick={() => setCurrentPhase('role_selection')}
            className="px-5 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            選擇角色
          </button>
        </div>
      )}
    </div>
  );
}
