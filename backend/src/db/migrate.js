require('dotenv').config();
const pool = require('./pool');

const sql = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    role          VARCHAR(10)  NOT NULL CHECK (role IN ('user', 'admin')),
    status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'inactive', 'suspended')),
    team_id       UUID         REFERENCES teams(id),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID         NOT NULL REFERENCES users(id),
    name        VARCHAR(255) NOT NULL,
    industry    VARCHAR(255),
    country     VARCHAR(255),
    memo        TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS company_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID        NOT NULL REFERENCES companies(id),
    user_id     UUID        NOT NULL REFERENCES users(id),
    permission  VARCHAR(10) NOT NULL CHECK (permission IN ('read', 'edit')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID        NOT NULL REFERENCES companies(id),
    created_by  UUID        NOT NULL REFERENCES users(id),
    input_type  VARCHAR(10) NOT NULL CHECK (input_type IN ('text', 'file', 'image')),
    language    VARCHAR(5)  NOT NULL CHECK (language IN ('en', 'ja')),
    owner_type  VARCHAR(10) NOT NULL DEFAULT 'personal'
                            CHECK (owner_type IN ('personal', 'team')),
    status      VARCHAR(15) NOT NULL DEFAULT 'processing'
                            CHECK (status IN ('processing', 'done', 'failed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS record_results (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id   UUID        NOT NULL REFERENCES records(id),
    result_type VARCHAR(15) NOT NULL CHECK (result_type IN ('summary', 'risk', 'mail_draft')),
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id),
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS record_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id   UUID        NOT NULL REFERENCES records(id),
    tag_id      UUID        NOT NULL REFERENCES tags(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id),
    token       TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
  );
`;

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
