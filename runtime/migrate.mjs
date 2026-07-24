import { query, literal } from './db.mjs';
import { hashPassword } from './auth.mjs';
query(`CREATE TABLE IF NOT EXISTS runtime_users(id BIGSERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'player',updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS runtime_ai_results(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES runtime_users(id) ON DELETE CASCADE,feature TEXT NOT NULL,prompt JSONB NOT NULL,response JSONB NOT NULL,provider_id TEXT NOT NULL,model TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
const email=String(process.env.PROVISION_ADMIN_EMAIL||'').trim().toLowerCase(), password=String(process.env.PROVISION_ADMIN_PASSWORD||''), name=String(process.env.PROVISION_ADMIN_NAME||'Runtime Player');
if(!email||password.length<12) throw new Error('Acceptance administrator credentials are required');
query(`INSERT INTO runtime_users(email,password_hash,name,role) VALUES(${literal(email)},${literal(hashPassword(password))},${literal(name)},'admin') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,name=EXCLUDED.name,role='admin',updated_at=NOW()`);
console.log(`Tetris runtime database ready for ${email}`);
