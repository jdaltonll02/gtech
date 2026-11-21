CREATE TABLE products (
  id uuid PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  kind text NOT NULL CHECK(kind IN('subscription','consumable')),
  tier text CHECK(tier IN('plus','gold','platinum')),
  consumable text CHECK(consumable IN('superlike_pack','boost_pack')),
  duration_days integer CHECK(duration_days>0),
  quantity integer NOT NULL DEFAULT 0 CHECK(quantity>=0),
  price_usd numeric(10,2) NOT NULL CHECK(price_usd>=0),
  price_lrd numeric(12,2) NOT NULL CHECK(price_lrd>=0),
  store_product_id_ios text NOT NULL DEFAULT '',
  store_product_id_android text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  CHECK((kind='subscription' AND tier IS NOT NULL AND duration_days IS NOT NULL AND consumable IS NULL)OR(kind='consumable' AND consumable IS NOT NULL AND tier IS NULL))
);
CREATE TABLE purchases (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  provider text NOT NULL CHECK(provider IN('apple','google','orange_money','mtn_momo','fake')),
  provider_ref text NOT NULL,
  status text NOT NULL CHECK(status IN('pending','succeeded','failed','refunded')),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL CHECK(currency IN('USD','LRD')),
  raw_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_ref)
);
CREATE INDEX purchases_user_created_idx ON purchases(user_id,created_at DESC);
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL UNIQUE REFERENCES purchases(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK(tier IN('plus','gold','platinum')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN('active','expired','cancelled','refunded')),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  auto_renew boolean NOT NULL DEFAULT false,
  provider text NOT NULL,
  original_transaction_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,original_transaction_id)
);
CREATE INDEX subscriptions_user_expiry_idx ON subscriptions(user_id,expires_at DESC);
CREATE TABLE wallets (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  superlikes_balance integer NOT NULL DEFAULT 0 CHECK(superlikes_balance>=0),
  boosts_balance integer NOT NULL DEFAULT 0 CHECK(boosts_balance>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE boosts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX boosts_active_idx ON boosts(user_id,expires_at DESC);
CREATE TABLE payment_events (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  event_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,event_id)
);

INSERT INTO products(id,sku,kind,tier,duration_days,price_usd,price_lrd,store_product_id_ios,store_product_id_android) VALUES
(gen_random_uuid(),'pepper_plus_week','subscription','plus',7,2.99,570,'pepper_plus_week','pepper_plus_week'),
(gen_random_uuid(),'pepper_plus_month','subscription','plus',30,7.99,1520,'pepper_plus_month','pepper_plus_month'),
(gen_random_uuid(),'pepper_plus_6month','subscription','plus',180,34.99,6650,'pepper_plus_6month','pepper_plus_6month'),
(gen_random_uuid(),'pepper_gold_week','subscription','gold',7,4.99,950,'pepper_gold_week','pepper_gold_week'),
(gen_random_uuid(),'pepper_gold_month','subscription','gold',30,12.99,2470,'pepper_gold_month','pepper_gold_month'),
(gen_random_uuid(),'pepper_gold_6month','subscription','gold',180,59.99,11400,'pepper_gold_6month','pepper_gold_6month'),
(gen_random_uuid(),'pepper_platinum_week','subscription','platinum',7,6.99,1330,'pepper_platinum_week','pepper_platinum_week'),
(gen_random_uuid(),'pepper_platinum_month','subscription','platinum',30,17.99,3420,'pepper_platinum_month','pepper_platinum_month'),
(gen_random_uuid(),'pepper_platinum_6month','subscription','platinum',180,79.99,15200,'pepper_platinum_6month','pepper_platinum_6month');
INSERT INTO products(id,sku,kind,consumable,quantity,price_usd,price_lrd,store_product_id_ios,store_product_id_android) VALUES
(gen_random_uuid(),'pepper_superlikes_5','consumable','superlike_pack',5,2.99,570,'pepper_superlikes_5','pepper_superlikes_5'),
(gen_random_uuid(),'pepper_boost_1','consumable','boost_pack',1,3.99,760,'pepper_boost_1','pepper_boost_1');
