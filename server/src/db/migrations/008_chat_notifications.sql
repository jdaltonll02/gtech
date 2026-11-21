ALTER TABLE matches
  ADD COLUMN unmatched_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN last_message_at timestamptz,
  ADD COLUMN initiated_by_superlike boolean NOT NULL DEFAULT false;

CREATE TABLE messages (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text','image','system')),
  body varchar(2000) NOT NULL DEFAULT '',
  media_key text,
  safety_warning boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sender_id, client_id)
);
CREATE INDEX messages_match_created_idx ON messages(match_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_matches boolean NOT NULL DEFAULT true,
  messages boolean NOT NULL DEFAULT true,
  likes boolean NOT NULL DEFAULT true,
  promotions boolean NOT NULL DEFAULT false,
  message_previews boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_logs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  dedup_key text NOT NULL UNIQUE,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','skipped','failed')),
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_logs_user_created_idx ON notification_logs(user_id, created_at DESC);
