require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./pool');

const SALT_ROUNDS = 10;

const seeds = [
  { email: 'admin@yakudoc.com', password: 'admin1234', name: '관리자', role: 'admin' },
  { email: 'user@yakudoc.com',  password: 'user1234',  name: '사용자', role: 'user'  },
];

async function seed() {
  const client = await pool.connect();
  try {
    for (const { email, password, name, role } of seeds) {
      const { rows } = await client.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );
      if (rows[0]) {
        console.log(`Skip: ${email} already exists`);
        continue;
      }
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      await client.query(
        `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)`,
        [email, password_hash, name, role]
      );
      console.log(`Created: ${email} (${role})`);
    }
    console.log('Seed completed.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
