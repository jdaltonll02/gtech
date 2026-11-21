CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  device_id uuid,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id, expires_at DESC);

CREATE TABLE social_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'apple')),
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, subject)
);

CREATE TABLE devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  fcm_token text NOT NULL DEFAULT '',
  app_version varchar(40) NOT NULL DEFAULT '',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_device_fk FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN show_gender_on_profile boolean NOT NULL DEFAULT true,
  ADD COLUMN orientation_ciphertext bytea,
  ADD COLUMN orientation_iv bytea,
  ADD COLUMN orientation_tag bytea,
  ADD COLUMN show_orientation boolean NOT NULL DEFAULT false,
  ADD COLUMN job_title varchar(100) NOT NULL DEFAULT '',
  ADD COLUMN company varchar(100) NOT NULL DEFAULT '',
  ADD COLUMN school varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN hometown varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN height_cm smallint CHECK (height_cm BETWEEN 90 AND 250),
  ADD COLUMN religion_ciphertext bytea,
  ADD COLUMN religion_iv bytea,
  ADD COLUMN religion_tag bytea,
  ADD COLUMN show_religion boolean NOT NULL DEFAULT false,
  ADD COLUMN prompts jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

CREATE TABLE interests (
  id uuid PRIMARY KEY,
  slug varchar(80) UNIQUE NOT NULL,
  label varchar(100) UNIQUE NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE TABLE profile_interests (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id uuid NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, interest_id)
);

CREATE TABLE passport_locations (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  point geography(Point, 4326) NOT NULL,
  label varchar(120) NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE photos (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 8),
  original_key text NOT NULL UNIQUE,
  variants jsonb NOT NULL DEFAULT '{}',
  blurhash text NOT NULL DEFAULT '',
  width integer,
  height integer,
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  like_score real NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, position)
);

INSERT INTO interests(id, slug, label, sort_order) VALUES
  (gen_random_uuid(), 'afrobeats', 'Afrobeats', 1), (gen_random_uuid(), 'hipco', 'Hipco', 2),
  (gen_random_uuid(), 'football', 'Football', 3), (gen_random_uuid(), 'church', 'Church', 4),
  (gen_random_uuid(), 'palm-butter-cooking', 'Palm butter cooking', 5), (gen_random_uuid(), 'robertsport-beach', 'Beach at Robertsport', 6),
  (gen_random_uuid(), 'nollywood', 'Nollywood', 7), (gen_random_uuid(), 'entrepreneurship', 'Entrepreneurship', 8),
  (gen_random_uuid(), 'travel', 'Travel', 9), (gen_random_uuid(), 'fitness', 'Fitness', 10),
  (gen_random_uuid(), 'reading', 'Reading', 11), (gen_random_uuid(), 'fashion', 'Fashion', 12),
  (gen_random_uuid(), 'cooking', 'Cooking', 13), (gen_random_uuid(), 'photography', 'Photography', 14),
  (gen_random_uuid(), 'live-music', 'Live music', 15), (gen_random_uuid(), 'volunteering', 'Volunteering', 16),
  (gen_random_uuid(), 'technology', 'Technology', 17), (gen_random_uuid(), 'business', 'Business', 18),
  (gen_random_uuid(), 'family', 'Family', 19), (gen_random_uuid(), 'beaches', 'Beaches', 20),
  (gen_random_uuid(), 'hiking', 'Hiking', 21), (gen_random_uuid(), 'art', 'Art', 22),
  (gen_random_uuid(), 'dance', 'Dance', 23), (gen_random_uuid(), 'coffee', 'Coffee', 24),
  (gen_random_uuid(), 'gardening', 'Gardening', 25), (gen_random_uuid(), 'gaming', 'Gaming', 26),
  (gen_random_uuid(), 'movies', 'Movies', 27), (gen_random_uuid(), 'poetry', 'Poetry', 28),
  (gen_random_uuid(), 'podcasts', 'Podcasts', 29), (gen_random_uuid(), 'running', 'Running', 30),
  (gen_random_uuid(), 'basketball', 'Basketball', 31), (gen_random_uuid(), 'cycling', 'Cycling', 32),
  (gen_random_uuid(), 'swimming', 'Swimming', 33), (gen_random_uuid(), 'yoga', 'Yoga', 34),
  (gen_random_uuid(), 'animals', 'Animals', 35), (gen_random_uuid(), 'nature', 'Nature', 36),
  (gen_random_uuid(), 'science', 'Science', 37), (gen_random_uuid(), 'history', 'History', 38),
  (gen_random_uuid(), 'languages', 'Languages', 39), (gen_random_uuid(), 'karaoke', 'Karaoke', 40),
  (gen_random_uuid(), 'jollof', 'Jollof rice', 41), (gen_random_uuid(), 'cassava-leaf', 'Cassava leaf', 42),
  (gen_random_uuid(), 'pepper-soup', 'Pepper soup', 43), (gen_random_uuid(), 'local-football', 'Liberian football', 44),
  (gen_random_uuid(), 'community', 'Community events', 45), (gen_random_uuid(), 'fishing', 'Fishing', 46),
  (gen_random_uuid(), 'farming', 'Farming', 47), (gen_random_uuid(), 'startups', 'Startups', 48),
  (gen_random_uuid(), 'design', 'Design', 49), (gen_random_uuid(), 'skincare', 'Skincare', 50),
  (gen_random_uuid(), 'comedy', 'Comedy', 51), (gen_random_uuid(), 'board-games', 'Board games', 52),
  (gen_random_uuid(), 'road-trips', 'Road trips', 53), (gen_random_uuid(), 'brunch', 'Brunch', 54),
  (gen_random_uuid(), 'mentoring', 'Mentoring', 55), (gen_random_uuid(), 'politics', 'Politics', 56),
  (gen_random_uuid(), 'environment', 'Environment', 57), (gen_random_uuid(), 'self-care', 'Self care', 58),
  (gen_random_uuid(), 'spoken-word', 'Spoken word', 59), (gen_random_uuid(), 'diaspora-events', 'Diaspora events', 60);
