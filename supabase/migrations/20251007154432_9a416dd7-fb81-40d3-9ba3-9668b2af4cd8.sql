-- Create rate_limits table for tracking API usage
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'vectorize', 'query', 'upload'
  action_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, action_type)
);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own rate limits"
  ON rate_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage rate limits"
  ON rate_limits FOR ALL
  USING (true);

-- Helper function to check/increment rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  _user_id UUID,
  _action_type TEXT,
  _limit INTEGER,
  _window_minutes INTEGER DEFAULT 60
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_start TIMESTAMPTZ;
BEGIN
  -- Get or create rate limit record
  SELECT action_count, rate_limits.window_start 
  INTO current_count, window_start
  FROM rate_limits
  WHERE user_id = _user_id AND action_type = _action_type;
  
  -- If record doesn't exist or window expired, reset
  IF NOT FOUND OR (now() - window_start) > (_window_minutes || ' minutes')::INTERVAL THEN
    INSERT INTO rate_limits (user_id, action_type, action_count, window_start)
    VALUES (_user_id, _action_type, 1, now())
    ON CONFLICT (user_id, action_type) 
    DO UPDATE SET action_count = 1, window_start = now();
    RETURN TRUE;
  END IF;
  
  -- Check if under limit
  IF current_count >= _limit THEN
    RETURN FALSE;
  END IF;
  
  -- Increment counter
  UPDATE rate_limits
  SET action_count = action_count + 1
  WHERE user_id = _user_id AND action_type = _action_type;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;