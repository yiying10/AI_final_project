-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create policies for rooms
CREATE POLICY "Enable read access for all users" ON rooms FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for room members" ON rooms FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = rooms.id 
        AND players.is_host = true
    )
);

-- Create policies for players
CREATE POLICY "Enable read access for all users" ON players FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for self" ON players FOR UPDATE USING (
    auth.uid() IS NOT NULL
);
CREATE POLICY "Enable delete for self" ON players FOR DELETE USING (
    auth.uid() IS NOT NULL
);

-- Create policies for messages
CREATE POLICY "Enable read access for room members" ON messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = messages.room_id
    )
);
CREATE POLICY "Enable insert for room members" ON messages FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = messages.room_id
    )
);

-- Create policies for game_scripts
CREATE POLICY "Enable read access for room members" ON game_scripts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = game_scripts.room_id
    )
);
CREATE POLICY "Enable insert for room host" ON game_scripts FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = game_scripts.room_id 
        AND players.is_host = true
    )
);

-- Create policies for evidence
CREATE POLICY "Enable read access for room members" ON evidence FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = evidence.room_id
    )
);
CREATE POLICY "Enable insert for room members" ON evidence FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = evidence.room_id
    )
);
CREATE POLICY "Enable update for room members" ON evidence FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = evidence.room_id
    )
);

-- Create policies for votes
CREATE POLICY "Enable read access for room members" ON votes FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = votes.room_id
    )
);
CREATE POLICY "Enable insert for room members" ON votes FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.room_id = votes.room_id
    )
); 