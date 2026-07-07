const pool = require('../db/pool');

async function getTags(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM tags WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ tags: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function createTag(req, res) {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM tags WHERE user_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [req.user.id, name]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: '이미 존재하는 태그입니다' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tags (user_id, name) VALUES ($1, $2) RETURNING id, name`,
      [req.user.id, name]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: '이미 존재하는 태그입니다' });
    }
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function updateTag(req, res) {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows: tags } = await pool.query(
      `SELECT user_id FROM tags WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!tags[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (tags[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows } = await pool.query(
      `UPDATE tags SET name = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, name`,
      [name, id]
    );
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function deleteTag(req, res) {
  const { id } = req.params;
  try {
    const { rows: tags } = await pool.query(
      `SELECT user_id FROM tags WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!tags[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (tags[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    await pool.query(`UPDATE tags SET deleted_at = NOW() WHERE id = $1`, [id]);
    return res.status(200).json({ message: '태그가 삭제되었습니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function checkRecordAccess(recordId, userId) {
  const { rows } = await pool.query(
    `SELECT company_id FROM records WHERE id = $1 AND deleted_at IS NULL`,
    [recordId]
  );
  const record = rows[0];
  if (!record) {
    return { exists: false, hasAccess: false };
  }

  const { rows: access } = await pool.query(
    `SELECT 1 FROM companies c
     LEFT JOIN company_members cm
       ON cm.company_id = c.id AND cm.user_id = $2 AND cm.deleted_at IS NULL
     WHERE c.id = $1 AND c.deleted_at IS NULL AND (c.owner_id = $2 OR cm.user_id IS NOT NULL)`,
    [record.company_id, userId]
  );
  return { exists: true, hasAccess: access.length > 0 };
}

async function addRecordTag(req, res) {
  const { id } = req.params;
  const { tag_id } = req.body;
  if (!tag_id) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { exists, hasAccess } = await checkRecordAccess(id, req.user.id);
    if (!exists) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (!hasAccess) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows: tags } = await pool.query(
      `SELECT id FROM tags WHERE id = $1 AND deleted_at IS NULL`,
      [tag_id]
    );
    if (tags.length === 0) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }

    const { rows: existingLink } = await pool.query(
      `SELECT id FROM record_tags WHERE record_id = $1 AND tag_id = $2`,
      [id, tag_id]
    );
    if (existingLink.length > 0) {
      return res.status(409).json({ error: '이미 연결된 태그입니다' });
    }

    await pool.query(
      `INSERT INTO record_tags (record_id, tag_id) VALUES ($1, $2)`,
      [id, tag_id]
    );
    return res.status(201).json({ record_id: id, tag_id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: '이미 연결된 태그입니다' });
    }
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function removeRecordTag(req, res) {
  const { id, tagId } = req.params;
  try {
    const { exists, hasAccess } = await checkRecordAccess(id, req.user.id);
    if (!exists) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (!hasAccess) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows } = await pool.query(
      `DELETE FROM record_tags WHERE record_id = $1 AND tag_id = $2 RETURNING id`,
      [id, tagId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    return res.status(200).json({ message: '태그 연결이 해제되었습니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

module.exports = {
  getTags,
  createTag,
  updateTag,
  deleteTag,
  addRecordTag,
  removeRecordTag,
};
