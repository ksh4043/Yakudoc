const pool = require('../db/pool');

async function getCompanies(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT c.id, c.name, c.industry, c.country, c.owner_id, c.created_at
       FROM companies c
       LEFT JOIN company_members cm
         ON cm.company_id = c.id AND cm.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
         AND (c.owner_id = $1 OR cm.user_id = $1)
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ companies: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function createCompany(req, res) {
  const { name, industry, country, memo } = req.body;
  if (!name || !industry || !country) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO companies (owner_id, name, industry, country, memo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, industry, country, memo`,
      [req.user.id, name, industry, country, memo ?? null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function getCompany(req, res) {
  const { id } = req.params;
  try {
    const { rows: companies } = await pool.query(
      `SELECT id, name, industry, country, memo, owner_id, created_at
       FROM companies
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!companies[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    const company = companies[0];

    const isOwner = company.owner_id === req.user.id;
    if (!isOwner) {
      const { rows: memberCheck } = await pool.query(
        `SELECT id FROM company_members
         WHERE company_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [id, req.user.id]
      );
      if (memberCheck.length === 0) {
        return res.status(403).json({ error: '권한이 없습니다' });
      }
    }

    const { rows: members } = await pool.query(
      `SELECT cm.user_id, u.name, cm.permission
       FROM company_members cm
       JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL
       WHERE cm.company_id = $1 AND cm.deleted_at IS NULL`,
      [id]
    );

    return res.status(200).json({ ...company, members });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function updateCompany(req, res) {
  const { id } = req.params;
  const { name, industry, country, memo } = req.body;
  if (name === undefined && industry === undefined && country === undefined && memo === undefined) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows: companies } = await pool.query(
      `SELECT owner_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!companies[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (companies[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (industry !== undefined) { fields.push(`industry = $${idx++}`); values.push(industry); }
    if (country !== undefined) { fields.push(`country = $${idx++}`); values.push(country); }
    if (memo !== undefined) { fields.push(`memo = $${idx++}`); values.push(memo); }
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE companies
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING id, name, industry, country, memo`,
      values
    );
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function deleteCompany(req, res) {
  const { id } = req.params;
  try {
    const { rows: companies } = await pool.query(
      `SELECT owner_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!companies[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (companies[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    await pool.query(
      `UPDATE companies SET deleted_at = NOW() WHERE id = $1`,
      [id]
    );
    return res.status(200).json({ message: '업체가 삭제되었습니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function addMember(req, res) {
  const { id } = req.params;
  const { user_id, permission } = req.body;
  if (!user_id || !permission) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows: companies } = await pool.query(
      `SELECT owner_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!companies[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (companies[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows: users } = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [user_id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: '존재하지 않는 사용자입니다' });
    }

    const { rows } = await pool.query(
      `INSERT INTO company_members (company_id, user_id, permission)
       VALUES ($1, $2, $3)
       RETURNING company_id, user_id, permission`,
      [id, user_id, permission]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function removeMember(req, res) {
  const { id, userId } = req.params;
  try {
    const { rows: companies } = await pool.query(
      `SELECT owner_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!companies[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (companies[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows } = await pool.query(
      `UPDATE company_members
       SET deleted_at = NOW()
       WHERE company_id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    return res.status(200).json({ message: '멤버가 제거되었습니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function getTransferCandidates(req, res) {
  const { id } = req.params;
  try {
    const { rows: companies } = await pool.query(
      `SELECT owner_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!companies[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (companies[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows: users } = await pool.query(
      `SELECT id, name
       FROM users
       WHERE id <> $1 AND status = 'active' AND deleted_at IS NULL
       ORDER BY name`,
      [companies[0].owner_id]
    );
    return res.status(200).json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function transferOwner(req, res) {
  const { id } = req.params;
  const { new_owner_id, keep_as_member = true } = req.body;
  if (!new_owner_id) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows: companies } = await client.query(
      `SELECT owner_id
       FROM companies
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );
    if (!companies[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }

    const currentOwnerId = companies[0].owner_id;
    if (currentOwnerId !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: '권한이 없습니다' });
    }
    if (new_owner_id === currentOwnerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '잘못된 요청입니다' });
    }

    const { rows: users } = await client.query(
      `SELECT id
       FROM users
       WHERE id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [new_owner_id]
    );
    if (!users[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '존재하지 않는 사용자입니다' });
    }

    const { rows } = await client.query(
      `UPDATE companies
       SET owner_id = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, owner_id`,
      [new_owner_id, id]
    );

    if (keep_as_member) {
      await client.query(
        `INSERT INTO company_members (company_id, user_id, permission)
         VALUES ($1, $2, 'edit')
         ON CONFLICT (company_id, user_id) WHERE deleted_at IS NULL
         DO UPDATE SET permission = 'edit'`,
        [id, currentOwnerId]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json(rows[0]);
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  getCompanies,
  createCompany,
  getCompany,
  updateCompany,
  deleteCompany,
  addMember,
  removeMember,
  getTransferCandidates,
  transferOwner,
};
