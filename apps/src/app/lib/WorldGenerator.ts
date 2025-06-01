import { supabase } from './supabaseClient';

// ----------- 型別定義 -----------
export interface Character {
  id: number;
  name: string;
  role: string;
  public_info: string;
  secret: string;
  mission: string;
}

export interface Npc {
  id: number;
  name: string;
  description: string;
  info: string;
}

export interface Dialogue {
  character: string;
  dialogue: string;
}

export interface Act {
  act_number: number;
  scripts: Dialogue[];
}

export interface GameObject {
  id: number;
  name: string;
  script_id: string;
  map_id: string;
  unlock: string | null;//npc_id
  clue: string | null;
  owner_id: number | null;
}

export interface Location {
  id: number;
  name: string;
  npcs: number[];
  objects: GameObject[];
}

export interface WorldData {
  characters: Character[];
  npcs: Npc[];
  acts: Act[];
  ending: string;
  locations: Location[];
}

// ----------- 生成世界 API 呼叫 -----------
export async function generateWorld(
  roomCode: number,
  prompt: string,
  background: string,
  options?: {
    num_characters?: number;
    num_npcs?: number;
    num_acts?: number;
    model?: string;
    temperature?: number;
  }
): Promise<WorldData> {
  try {
    const response = await fetch(`http://127.0.0.1:8000/api/world/world/games/generate_full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        background: background,
        num_characters: 4,
        num_npcs: options?.num_npcs || 3,
        num_acts: options?.num_acts || 2,
        model: options?.model || 'gemini-2.0-flash',
        temperature: options?.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error details:', errorData);
      const detail = Array.isArray(errorData.detail)
        ? errorData.detail.map((d: any) => `${d.loc.join('.')} - ${d.msg}`).join('; ')
        : errorData.detail;
      throw new Error(`Error ${response.status}: ${detail || response.statusText}`);
    }

    const data = await response.json();
    console.log('World generated:', data);
    return data as WorldData;
  } catch (error) {
    console.error('Error generating world:', error);
    throw error;
  }
}

// ----------- 生成並儲存到資料庫 -----------
export async function generateWorldAndSave(
  roomId: string,
  roomCode: number,
  prompt: string,
  background: string,
  options?: {
    num_characters?: number;
    num_npcs?: number;
    num_acts?: number;
    model?: string;
    temperature?: number;
  }
) {
  try {
    const worldData = await generateWorld(roomCode, prompt, background, options);
    if (!worldData) throw new Error('生成世界內容失敗');

    const { data: script, error: scriptError } = await supabase
      .from('gamescript')
      .insert({
        room_id: roomId,
        prompt: prompt,
        background: background,
        answer: worldData.ending,
      })
      .select()
      .single();

    if (scriptError || !script) throw new Error('儲存 GameScript 失敗: ' + scriptError?.message);
    const scriptId = script.id;
    
    const { error: roomError } = await supabase
      .from('room')
      .update({ script_id: scriptId })
      .eq('id', roomId);

    if (roomError) throw new Error('更新 room 的 script_id 失敗: ' + roomError.message);

    const roles = worldData.characters.map((char) => {
      const act1 = worldData.acts[0]?.scripts.find((s) => s.character === char.name)?.dialogue || '';
      const act2 = worldData.acts[1]?.scripts.find((s) => s.character === char.name)?.dialogue || '';
      return {
        script_id: scriptId,
        name: char.name,
        public_info: char.public_info,
        secret: char.secret,
        mission: char.mission,
        dialogue1: act1,
        dialogue2: act2,
      };
    });
    await supabase.from('gamerole').insert(roles);

    const maps = worldData.locations.map((loc) => ({
      script_id: scriptId,
      name: loc.name,
    }));
    const { data: mapInserts, error: mapError } = await supabase.from('gamemap').insert(maps).select();
    if (mapError) throw new Error('儲存 GameMap 失敗: ' + mapError.message);

    const mapIdLookup = new Map(mapInserts.map((m) => [m.name, m.id]));
    
    const npcs = worldData.locations.flatMap((loc) =>
      loc.npcs.map((npcId) => {
        const npcData = worldData.npcs.find((n) => n.id === npcId);
        return {
          script_id: scriptId,
          map_id: mapIdLookup.get(loc.name),
          name: npcData?.name || '',
          info: npcData?.description || ''
        };
      })
    );
    await supabase.from('gamenpc').insert(npcs);

    // 處理 GameObject
    const objects = worldData.locations.flatMap((loc) =>
      loc.objects.map((obj) => ({
        script_id: scriptId,
        map_id: mapIdLookup.get(loc.name),
        name: obj.name,
        content: obj.clue || '',
        unlock: obj.unlock ?? null,
      }))
    );

    if (objects.length > 0) {
      const { error: objectError } = await supabase.from('gameobject').insert(objects);
      if (objectError) throw new Error('儲存 GameObject 失敗: ' + objectError.message);
    }

    // 處理 UnlockObject（只挑有 owner_id 的）
    // const unlockObjects = worldData.locations.flatMap((loc) =>
    //   loc.objects
    //     .filter((obj) => obj.owner_id !== null)
    //     .map((obj) => ({
    //       script_id: scriptId,
    //       npc_id: null,  // 如果未來有 NPC 解鎖邏輯再補
    //       name: obj.name + ' 解鎖道具',
    //       content: obj.clue || '',
    //       owner_id: obj.owner_id,
    //     }))
    // );

    // if (unlockObjects.length > 0) {
    //   const { error: unlockError } = await supabase.from('unlockobject').insert(unlockObjects);
    //   if (unlockError) throw new Error('儲存 UnlockObject 失敗: ' + unlockError.message);
    // }


    console.log('世界資料寫入成功！');
    return { success: true, scriptId };
  } catch (error) {
    console.error('世界資料寫入失敗：', error);
    throw error;
  }
}
