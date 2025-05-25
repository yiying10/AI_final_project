-- 检查并更新 rooms 表
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rooms' AND column_name = 'current_phase'
    ) THEN
        ALTER TABLE rooms ADD COLUMN current_phase VARCHAR(50) DEFAULT 'waiting';
    END IF;
END $$;

-- 检查并更新 players 表
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'is_ready'
    ) THEN
        ALTER TABLE players ADD COLUMN is_ready BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 确保所有必要的索引存在
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'rooms' AND indexname = 'rooms_code_idx'
    ) THEN
        CREATE INDEX rooms_code_idx ON rooms(code);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'players' AND indexname = 'players_room_id_idx'
    ) THEN
        CREATE INDEX players_room_id_idx ON players(room_id);
    END IF;
END $$; 