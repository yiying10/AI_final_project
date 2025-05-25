-- 創建劇本表
CREATE TABLE game_scripts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  background TEXT NOT NULL,
  scene TEXT NOT NULL,
  time_setting TEXT NOT NULL,
  summary TEXT NOT NULL,
  characters JSONB NOT NULL,
  clues JSONB NOT NULL,
  flow JSONB NOT NULL,
  victory_rules JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 修改 rooms 表，添加劇本相關字段
ALTER TABLE rooms
ADD COLUMN script_id UUID REFERENCES game_scripts(id),
ADD COLUMN started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN status VARCHAR(50) DEFAULT 'waiting';

-- 創建證物表
CREATE TABLE evidence (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  location_id TEXT NOT NULL,
  is_direct BOOLEAN DEFAULT false,
  found BOOLEAN DEFAULT false,
  found_by UUID REFERENCES players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建投票表
CREATE TABLE votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES players(id) ON DELETE CASCADE,
  suspect_id UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
); 