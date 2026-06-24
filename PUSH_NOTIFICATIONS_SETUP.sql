-- ============================================================
-- Push Notifications — run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription     jsonb NOT NULL,          -- Web Push subscription object
  notification_time text NOT NULL DEFAULT '09:00',  -- HH:MM in user's local time
  utc_offset_mins  integer NOT NULL DEFAULT 0,       -- from -new Date().getTimezoneOffset()
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)  -- one active subscription per user
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscription via the browser
CREATE POLICY "Users can manage own push subscription"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
