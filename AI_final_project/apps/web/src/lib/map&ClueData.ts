export interface GameContent {
    location: string;
    objects: { name: string; clue: string }[];
    }
    
    const map_locations = [
    "圖書館",
    "教職員辦公室",
    "化學實驗室",
    "體育館",
    "宿舍"
    ];
    
    const map_objects: Record<string, string[]> = {
    "圖書館": ["書架", "閱讀桌", "藏書室門口"],
    "教職員辦公室": ["文件櫃", "辦公桌"],
    "化學實驗室": ["藥品櫃", "工作台", "通風櫃"],
    "體育館": ["儲物櫃", "球具箱"],
    "宿舍": ["床底", "書桌", "垃圾桶"]
    };
    
    const map_clues: Record<string, string> = {
    "書架": "發現了一本夾著泛黃照片的日記",
    "閱讀桌": "桌下貼著一張寫有神秘代碼的便條紙",
    "藏書室門口": "地上有一條拖行的血跡",
    "文件櫃": "找到一份被撕掉一角的教師合約副本",
    "辦公桌": "抽屜裡藏著學生的警告信",
    "藥品櫃": "有瓶標示不清的化學藥品缺了一半",
    "工作台": "殘留詭異粉末的試管還沒洗",
    "通風櫃": "裡面有一個燒焦的實驗報告",
    "儲物櫃": "有一隻染血的球鞋",
    "球具箱": "藏著一把斷掉的球棒",
    "床底": "藏有一個裝著現金的信封",
    "書桌": "抽屜底下貼著偷拍的照片",
    "垃圾桶": "丟棄的信紙提及某個威脅行為"
    };
    
    export function getGameContent(): GameContent[] {
    return map_locations.map((location) => ({
    location,
    objects: map_objects[location].map((object) => ({
    name: object,
    clue: map_clues[object] || "沒有發現任何線索",
    })),
    }));
    }