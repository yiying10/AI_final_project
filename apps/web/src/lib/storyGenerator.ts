import { supabase } from './supabaseClient';

interface Character {
  name: string;
  role: string;
  public_info: string;
  secret: string;
  mission: string;
}

export interface GameScript {
  id: string;
  title: string;
  background: string;
  scene: string;
  time_setting: string;
  summary: string;
  characters: Character[];
  clues: string[];
  flow: string[];
  victory_rules: {
    murderer_win: string;
    justice_win: string;
    neutral_win: string;
  };
}

const defaultScript: GameScript = {
  id: 'default',
  title: '謀殺之鐘',
  background: '1937 年歐洲戰前，英國西郊的沃倫莊園，鐘錶匠艾德加爵士神秘死亡，胸口插著錐形發條鑰。',
  scene: '封閉的莊園、突發停電與鐘響的深夜',
  time_setting: '1937 年，歐洲英國鄉間莊園深夜',
  summary: '上流社會鐘錶匠艾德加爵士被殺，6 名訪客皆有嫌疑，密室謀殺與複雜關係交織，真相藏在每人心中。',
  characters: [
    {
      name: '海倫·蘭道爾',
      role: '遠房姪女',
      public_info: '剛從巴黎回來，據說即將繼承財產',
      secret: '假冒身份混入',
      mission: '找到真正的遺囑並銷毀'
    },
    {
      name: '查爾斯·葛雷',
      role: '私人醫生',
      public_info: '多年來為爵士診治高血壓',
      secret: '曾參與不法醫療實驗',
      mission: '銷毀實驗紀錄並掩飾過往'
    },
    {
      name: '瑪格麗特·威爾森',
      role: '莊園管家',
      public_info: '在莊園服務二十年，深得信任',
      secret: '是爵士與女僕之女',
      mission: '查出殺父仇人'
    },
    {
      name: '西蒙·布萊克',
      role: '富商之子',
      public_info: '與爵士有商業合作',
      secret: '逼迫簽署借據',
      mission: '取得契約並脅迫其他人'
    },
    {
      name: '伊莎貝拉·摩根',
      role: '神秘小說家',
      public_info: '來蒐集小說素材',
      secret: '曾與爵士有情感糾葛並懷恨',
      mission: '留下筆記作為小說素材'
    },
    {
      name: '喬治·斯通',
      role: '莊園司機',
      public_info: '寡言忠誠，尊敬爵士',
      secret: '目睹兇手行兇，感激其人',
      mission: '掩蓋兇手證據'
    }
  ],
  clues: [
    '死者手上握有模糊簽名的遺囑草稿',
    '起居室壁爐有信封殘骸',
    '書房中一只座鐘缺少發條鑰',
    '玻璃走廊有泥鞋印但窗戶封閉'
  ],
  flow: [
    '開場介紹與公開線索',
    '第一輪自由調查與對話',
    '突發事件：鐘塔響起、停電反鎖',
    '第二輪交叉盤問與個人任務觸發',
    '第三輪提示與任務進度更新',
    '最終投票與揭曉兇手'
  ],
  victory_rules: {
    murderer_win: '未被投出並誤導多數人',
    justice_win: '成功投出兇手並完成任務',
    neutral_win: '完成個人目標，如洩漏秘密或逃脫'
  }
};

export async function generateStory(roomId: string): Promise<GameScript> {
  try {
    // 檢查是否已經存在劇本
    const { data: existingScript, error: checkError } = await supabase
      .from('game_scripts')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 是 "no rows returned" 錯誤
      throw checkError;
    }

    if (existingScript) {
      return existingScript;
    }

    // 插入固定劇本
    const { data: script, error: insertError } = await supabase
      .from('game_scripts')
      .insert([
        {
          room_id: roomId,
          title: '謀殺之鐘',
          background: '1937 年歐洲戰前，英國西郊的沃倫莊園，鐘錶匠艾德加爵士神秘死亡，胸口插著錐形發條鑰。',
          scene: '封閉的莊園、突發停電與鐘響的深夜',
          time_setting: '1937 年，歐洲英國鄉間莊園深夜',
          summary: '上流社會鐘錶匠艾德加爵士被殺，6 名訪客皆有嫌疑，密室謀殺與複雜關係交織，真相藏在每人心中。',
          characters: [
            {
              name: '海倫·蘭道爾',
              role: '遠房姪女',
              public_info: '剛從巴黎回來，據說即將繼承財產',
              secret: '假冒身份混入',
              mission: '找到真正的遺囑並銷毀'
            },
            {
              name: '查爾斯·葛雷',
              role: '私人醫生',
              public_info: '多年來為爵士診治高血壓',
              secret: '曾參與不法醫療實驗',
              mission: '銷毀實驗紀錄並掩飾過往'
            },
            {
              name: '瑪格麗特·威爾森',
              role: '莊園管家',
              public_info: '在莊園服務二十年，深得信任',
              secret: '是爵士與女僕之女',
              mission: '查出殺父仇人'
            },
            {
              name: '西蒙·布萊克',
              role: '富商之子',
              public_info: '與爵士有商業合作',
              secret: '逼迫簽署借據',
              mission: '取得契約並脅迫其他人'
            },
            {
              name: '伊莎貝拉·摩根',
              role: '神秘小說家',
              public_info: '來蒐集小說素材',
              secret: '曾與爵士有情感糾葛並懷恨',
              mission: '留下筆記作為小說素材'
            },
            {
              name: '喬治·斯通',
              role: '莊園司機',
              public_info: '寡言忠誠，尊敬爵士',
              secret: '目睹兇手行兇，感激其人',
              mission: '掩蓋兇手證據'
            }
          ],
          clues: [
            '死者手上握有模糊簽名的遺囑草稿',
            '起居室壁爐有信封殘骸',
            '書房中一只座鐘缺少發條鑰',
            '玻璃走廊有泥鞋印但窗戶封閉'
          ],
          flow: [
            '開場介紹與公開線索',
            '第一輪自由調查與對話',
            '突發事件：鐘塔響起、停電反鎖',
            '第二輪交叉盤問與個人任務觸發',
            '第三輪提示與任務進度更新',
            '最終投票與揭曉兇手'
          ],
          victory_rules: {
            murderer_win: '未被投出並誤導多數人',
            justice_win: '成功投出兇手並完成任務',
            neutral_win: '完成個人目標，如洩漏秘密或逃脫'
          }
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('插入劇本時出錯：', insertError);
      throw new Error('無法創建劇本：' + insertError.message);
    }

    if (!script) {
      throw new Error('劇本創建失敗：未返回數據');
    }

    return script;
  } catch (error) {
    console.error('生成劇本時出錯：', error);
    throw error;
  }
}

// 驗證玩家行為是否符合劇本
export async function validateAction(
  script: GameScript,
  action: string,
  playerRole: string
): Promise<{ valid: boolean; message: string }> {
  // 找到對應的角色
  const character = script.characters.find(c => c.role === playerRole);
  if (!character) {
    return {
      valid: false,
      message: '找不到對應的角色信息'
    };
  }

  // 簡單的驗證邏輯
  const valid = true; // 這裡可以添加更複雜的驗證邏輯
  const message = '行為符合角色設定';

  return { valid, message };
} 