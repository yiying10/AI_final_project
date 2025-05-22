-- 添加房間當前階段欄位
ALTER TABLE rooms
ADD COLUMN current_phase VARCHAR(50) DEFAULT 'waiting';

-- 創建已發現線索表
CREATE TABLE discovered_clues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  clue TEXT NOT NULL,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建玩家投票表
CREATE TABLE player_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES players(id) ON DELETE CASCADE,
  voted_for_id UUID REFERENCES players(id) ON DELETE CASCADE,
  vote_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, voter_id)
);

-- 創建遊戲結果表
CREATE TABLE game_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  murderer_id UUID REFERENCES players(id) ON DELETE CASCADE,
  winner_type VARCHAR(50) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
); 