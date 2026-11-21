CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE user_status AS ENUM ('active', 'paused', 'banned', 'deleted');
CREATE TABLE users (
  id uuid PRIMARY KEY,
  phone_e164 text UNIQUE,
  email text,
  status user_status NOT NULL DEFAULT 'active',
  is_staff boolean NOT NULL DEFAULT false,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_challenges (
  id uuid PRIMARY KEY,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at timestamptz,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_phone_created_idx ON otp_challenges(phone_e164, created_at DESC);

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(80),
  birth_date date CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE - INTERVAL '18 years'),
  gender text CHECK (gender IN ('woman', 'man', 'nonbinary')),
  bio varchar(500) NOT NULL DEFAULT '',
  county text,
  languages text[] NOT NULL DEFAULT '{}',
  relationship_goal text,
  completeness smallint NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE discovery_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_me text[] NOT NULL DEFAULT '{woman,man,nonbinary}',
  age_min smallint NOT NULL DEFAULT 18,
  age_max smallint NOT NULL DEFAULT 50,
  max_distance_km smallint NOT NULL DEFAULT 50 CHECK (max_distance_km BETWEEN 2 AND 160),
  counties_filter text[] NOT NULL DEFAULT '{}',
  global_mode boolean NOT NULL DEFAULT false,
  is_discoverable boolean NOT NULL DEFAULT true
);

CREATE TABLE locations (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  point geography(Point, 4326) NOT NULL,
  geo_cell bigint NOT NULL,
  accuracy_m real,
  source text NOT NULL CHECK (source IN ('gps', 'ip', 'manual_county')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX locations_geo_cell_idx ON locations(geo_cell);
CREATE INDEX locations_point_idx ON locations USING gist(point);
