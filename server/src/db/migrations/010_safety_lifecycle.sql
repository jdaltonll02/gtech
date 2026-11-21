CREATE TABLE reports (
  id uuid PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(reason IN('fake_profile','underage','harassment','scam','nudity','offensive','other')),
  details varchar(1000) NOT NULL DEFAULT '',
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN('open','actioned','dismissed')),
  handled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(reporter_id<>reported_id)
);
CREATE INDEX reports_status_created_idx ON reports(status,created_at DESC);

CREATE TABLE verifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pose_code varchar(80) NOT NULL,
  selfie_key text,
  status text NOT NULL DEFAULT 'started' CHECK(status IN('started','pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX verifications_one_open_idx ON verifications(user_id) WHERE status IN('started','pending');
CREATE INDEX verifications_status_created_idx ON verifications(status,created_at);

CREATE TABLE moderation_actions (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  verification_id uuid REFERENCES verifications(id) ON DELETE SET NULL,
  photo_id uuid REFERENCES photos(id) ON DELETE SET NULL,
  action text NOT NULL CHECK(action IN('dismiss_report','warn','ban','remove_photo','approve_verification','reject_verification')),
  notes varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_target_created_idx ON moderation_actions(target_user_id,created_at DESC);

CREATE TABLE account_deletion_requests (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  hard_delete_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
  cancelled_at timestamptz
);

CREATE TABLE account_exports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
