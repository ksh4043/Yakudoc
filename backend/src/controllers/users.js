const bcrypt = require('bcrypt');
const pool = require('../db/pool');

async function getUsers(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, status, created_at
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );
    return res.status(200).json({ users: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function createUser(req, res) {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [email, passwordHash, name, role]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { role, status } = req.body;
  if (role === undefined && status === undefined) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(role);
    }
    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING id, name, role, status`,
      values
    );
    if (!rows[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function deleteUser(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET deleted_at = NOW(), status = 'inactive'
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    return res.status(200).json({ message: '계정이 비활성화되었습니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

module.exports = { getUsers, createUser, updateUser, deleteUser };
