-- ============================================================
-- Kevin's Health Tracker — Supabase SQL Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. HABITS TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_deleted  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS habits_user_id_idx ON habits (user_id);

-- Row-Level Security
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habits"
  ON habits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habits"
  ON habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits"
  ON habits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits"
  ON habits FOR DELETE
  USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 2. DAILY LOGS TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date         date NOT NULL,
  mood             smallint CHECK (mood BETWEEN 1 AND 5),
  habit_ids        uuid[] NOT NULL DEFAULT '{}',
  food_raw         text,
  food_parsed      jsonb,              -- array of {name, matched_name, calories, ulcer_risk}
  total_calories   integer,
  ulcer_clear      boolean NOT NULL DEFAULT true,
  ulcer_count      smallint,
  ulcer_pain       smallint CHECK (ulcer_pain BETWEEN 1 AND 5),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- One log per user per day
  UNIQUE (user_id, log_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS daily_logs_user_date_idx ON daily_logs (user_id, log_date DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row-Level Security
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
  ON daily_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON daily_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs"
  ON daily_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs"
  ON daily_logs FOR DELETE
  USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 3. DONE ✓
-- After running this:
--   1. Go to Authentication → Users → Add user → enter your email + password
--   2. Add your Supabase URL and publishable key to .env
--   3. Run: npm install && npm run dev
-- ────────────────────────────────────────────────────────────
