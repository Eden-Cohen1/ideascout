-- ideascout Postgres init. Runs once on first container start.
-- pgcrypto is handy for gen_random_uuid()/digest if ever needed at the DB layer
-- (app-level secrets use AES-256-GCM in the API, not pgcrypto).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
