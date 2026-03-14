CREATE TABLE IF NOT EXISTS auth_tokens (
  id            SERIAL PRIMARY KEY,
  user_id       VARCHAR(50)  NOT NULL,
  token         TEXT         NOT NULL UNIQUE,
  device_info   TEXT,
  ip_address    VARCHAR(45),
  logged_in_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  logged_out_at TIMESTAMPTZ,
  logout_reason VARCHAR(30),            -- 'self' | 'remote' | 'expired'
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user    ON auth_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_active  ON auth_tokens (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token   ON auth_tokens (token)     WHERE is_active = TRUE;
