ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check CHECK (subscription_tier IS NULL OR subscription_tier ~ '^\d+$');
