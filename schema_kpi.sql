-- Run this in Supabase SQL Editor to add KPI + Team features

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  avatar_color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on team_members" ON team_members FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text CHECK (status IN ('pending', 'approved', 'review', 'done')) DEFAULT 'pending',
  amount numeric,
  due_date date,
  assigned_to uuid REFERENCES team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS monthly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  month int NOT NULL,
  revenue_target numeric NOT NULL DEFAULT 0,
  UNIQUE(year, month)
);

ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on monthly_targets" ON monthly_targets FOR ALL USING (true) WITH CHECK (true);
