CREATE TABLE swipes (
  id uuid PRIMARY KEY,
  swiper_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  swipee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('like','nope','superlike')),
  rewound boolean NOT NULL DEFAULT false,
  client_ts timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (swiper_id <> swipee_id),
  UNIQUE (swiper_id, swipee_id)
);
CREATE INDEX swipes_incoming_idx ON swipes(swipee_id, action, created_at DESC) WHERE rewound=false;

CREATE TABLE matches (
  id uuid PRIMARY KEY,
  user_a_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  unmatched_at timestamptz,
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX matches_user_a_idx ON matches(user_a_id, created_at DESC) WHERE unmatched_at IS NULL;
CREATE INDEX matches_user_b_idx ON matches(user_b_id, created_at DESC) WHERE unmatched_at IS NULL;
