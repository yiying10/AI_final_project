# 🕵️‍♂️ AI-Generated Murder Mystery Game System

This project is an AI system for automatically generating **murder mystery game content** based on a given theme. It uses a LLM via prompt engineering to create a **complete game script** including background stories, characters, secrets, clues, NPC dialogues, and interactive map elements. The system solves the problem of inaccessible murder mystery scripts and provides an instant, playable game experience.

---

## 📖 Overview of the Task

- **Goal**: Automatically generate playable murder mystery game content, including:
  - Background story
  - Character profiles (name, public information, secrets, missions)
  - Clues and objects
  - Interactive NPC dialogues
  - Game map

- **Motivation**: Solving the challenge of hard-to-access murder mystery content, enabling on-demand, customizable gameplay.

- **Approach**: Use LLM APIs (e.g. Google Gemini 2.0 Flash) with prompt engineering to generate the entire game content in one pass based on a given theme.

---

## 🛠️ Prerequisites

### Backend (FastAPI)
- fastapi 0.115.12
- uvicorn[standard] 0.34.2
- sqlmodel 0.0.24
- python-dotenv 1.1.0
- google-genai 1.16.1
- pytest
- httpx 0.28.1
- jsonschema
- pytest-asyncio
### Frontend (React)
- Node.js 22.13.0
- React 19.1.0
- TailwindCSS 4.1.7
### Install dependencies:
Go to https://ai.google.dev/gemini-api/docs/quickstart?lang=python&hl=zh-tw. Get API key and put into _back-end/backend/.env_
```bash
pip install -r requirements.txt
npm install
```
## 🚀 Usage
```
# Start the FastAPI server:
cd back-end
python -m uvicorn --reload backend.app.main:app

# Start the React development server:
cd apps
npm run dev
```

---

## 🎛️ Hyperparameters
|Parameter|Value|
|---|---|
|Model|Google Gemini 2.0 Flash|
|Temperature|0.7|
|Max Tokens|1000|


## 🧪 Experiment Results
- **Experiment 1**:Impact of Temperature on Generated Text:
  - Optimal temperature 0.7 : delivers the best balance between topical relevance and both the integrity and diversity of sentence structures
- **Experiment 2**:Prompt-Design Effects on LLM Task Success:
  -  Rule-oriented > Creative-oriented : the model complies far more reliably with explicit, formal constraints than with open-ended creative requests
  - Example-driven > Abstract description : supplying concrete sample outputs markedly improves format consistency and task-completion rates, whereas abstract guidelines alone rarely achieve the desired results

---

## 📂 Project Structure(Only list main files)
```
apps/
└── src/
│   └── app/
│       ├── lib/
│       │   ├── backgroundGenerator.ts       # 呼叫後端生成背景
│       │   ├── chatWithNPC.ts               # 呼叫後端與 NPC 對話
│       │   └── WorldGenerator.ts            # 呼叫後端生成完整世界
│       ├── phases/                          # 控制遊戲流程，依階段分檔案
│       ├── room/
│       │   ├── [code]/
│       │   │   ├── page.tsx                 # 房間頁面
│       │   │   └── ChatRoom.tsx             # 聊天室頁面
│       ├── GameContent.tsx                  # 顯示完整遊戲內容
│       └── page.tsx                         # 初始頁面
└── back-end/
    ├── requirements.txt
    └── backend/
        ├── app/
        │   ├── routers/
        │   │   ├── chat.py                      # 處理 NPC 對話的 API
        │   │   ├── npcs.py                      # 處理 NPC 資料的 API
        │   │   ├── players.py                   # 處理玩家資料的 API
        │   │   ├── world_gen.py                 # 處理生成世界的 API
        │   │   └── world.py                     # 處理背景故事的 API
        │   ├── services/
        │   │   ├── llm_service.py               # 與 LLM API 溝通的服務
        │   │   └── memory_services.py           # 管理遊戲狀態的記憶體服務
        │   ├── utils/
        │   ├── database.py                      # 資料庫連接
        │   ├── main.py                          # FastAPI 主入口
        │   ├── models.py                        # Pydantic 模型定義
        ├── .env                                 # 環境變數設定
```

## 📄 Additional Documentation

### Tree Rendering Analysis
This repository also includes a comprehensive technical analysis of 3D tree rendering from another Computer Graphics project:

- **[樹木渲染分析 (中文)](TREE_RENDERING_ANALYSIS.md)** - Detailed analysis of tree rendering techniques in CG-FinalProject, including OpenGL implementation, shader programming, and rendering pipeline optimization
- **[Tree Rendering Analysis (English)](TREE_RENDERING_ANALYSIS_EN.md)** - English version of the tree rendering technical documentation

These documents provide in-depth explanations of:
- OBJ file structure and material systems
- Batch rendering optimization techniques
- OpenGL buffer management and VAO/VBO usage
- Vertex and fragment shader implementation
- Texture mapping and coordinate system handling

---

## 📚 References
- Liu, P., Yuan, W., Fu, J., et al. (2023). Pre-train, prompt, and predict: A systematic survey of prompting methods in natural language processing. ACM Computing Surveys, 55(9), 1-35.
- Yang, K., Klein, D., Peng, N., & Yao, Y. (2022). DOC: Improving long story coherence with detailed outline control. Proceedings of the 60th Annual Meeting of the Association for Computational Linguistics, 4378-4392.
- Porteous, J., & Cavazza, M. (2009). Controlling narrative generation with planning trajectories: The role of constraints. Interactive Storytelling, 234-245.)
- https://ithelp.ithome.com.tw/m/articles/10349538
