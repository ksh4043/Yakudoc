const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, name, role, status
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );
    const user = rows[0];
    const valid = user && await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: '비활성화된 계정입니다' });
    }
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    return res.status(200).json({
      access_token: accessToken,
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function refresh(req, res) {
  const token = req.cookies.refresh_token;
  if (!token) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
  try {
    try {
      jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    }
    const { rows } = await pool.query(
      `SELECT id, user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    }
    const { id: tokenId, user_id: userId } = rows[0];
    const { rows: userRows } = await pool.query(
      `SELECT id, email, name, role FROM users
       WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [userId]
    );
    if (!userRows[0]) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    }
    const user = userRows[0];
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const newRefreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [tokenId]);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, newRefreshToken, newExpiresAt]
    );
    res.cookie('refresh_token', newRefreshToken, COOKIE_OPTIONS);
    return res.status(200).json({ access_token: newAccessToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function logout(req, res) {
  const token = req.cookies.refresh_token;
  if (token) {
    try {
      await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
    } catch (err) {
      console.error(err);
    }
  }
  res.clearCookie('refresh_token', COOKIE_OPTIONS);
  return res.status(200).json({ message: '로그아웃 되었습니다' });
}

module.exports = { login, refresh, logout };
