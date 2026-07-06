const pool = require('../db/pool');
const { getAIService } = require('../services/aiService');

async function getCompanyOwner(companyId) {
  const { rows } = await pool.query(
    `SELECT owner_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
    [companyId]
  );
  return rows[0] || null;
}

async function isCompanyMember(companyId, userId) {
  const { rows } = await pool.query(
    `SELECT id FROM company_members WHERE company_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [companyId, userId]
  );
  return rows.length > 0;
}

async function checkCompanyAccess(companyId, userId) {
  const company = await getCompanyOwner(companyId);
  if (!company) {
    return { exists: false, hasAccess: false };
  }
  if (company.owner_id === userId) {
    return { exists: true, hasAccess: true };
  }
  const isMember = await isCompanyMember(companyId, userId);
  return { exists: true, hasAccess: isMember };
}

async function processRecordAsync(recordId, { input_type, language, content, fileBuffer, mimeType }) {
  let result;
  try {
    const aiService = getAIService();
    result = await aiService.analyzeDocument({
      inputType: input_type,
      language,
      content,
      fileBuffer,
      mimeType,
    });
  } catch (err) {
    console.error(err);
    try {
      await pool.query(`UPDATE records SET status = 'failed' WHERE id = $1`, [recordId]);
    } catch (updateErr) {
      console.error(updateErr);
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO record_results (record_id, result_type, content)
       VALUES ($1, 'summary', $2), ($1, 'risk', $3), ($1, 'mail_draft', $4)`,
      [recordId, result.summary, result.risk, result.mail_draft]
    );
    await client.query(`UPDATE records SET status = 'done' WHERE id = $1`, [recordId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    try {
      await pool.query(`UPDATE records SET status = 'failed' WHERE id = $1`, [recordId]);
    } catch (updateErr) {
      console.error(updateErr);
    }
  } finally {
    client.release();
  }
}

async function createRecord(req, res) {
  const { id: companyId } = req.params;
  const { input_type, language, content } = req.body;
  const file = req.file;

  if (!['text', 'file', 'image'].includes(input_type) || !['en', 'ja'].includes(language)) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  if (input_type === 'text' && !content) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  if (input_type !== 'text' && !file) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }

  try {
    const { exists, hasAccess } = await checkCompanyAccess(companyId, req.user.id);
    if (!exists) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (!hasAccess) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows } = await pool.query(
      `INSERT INTO records (company_id, created_by, input_type, language, status)
       VALUES ($1, $2, $3, $4, 'processing')
       RETURNING id`,
      [companyId, req.user.id, input_type, language]
    );
    const recordId = rows[0].id;

    res.status(202).json({ record_id: recordId, status: 'processing' });

    processRecordAsync(recordId, {
      input_type,
      language,
      content,
      fileBuffer: file ? file.buffer : undefined,
      mimeType: file ? file.mimetype : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function getRecord(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, company_id, status, language, created_at
       FROM records
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const record = rows[0];
    if (!record) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }

    const { exists, hasAccess } = await checkCompanyAccess(record.company_id, req.user.id);
    if (!exists) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (!hasAccess) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    if (record.status === 'processing') {
      return res.status(200).json({ id: record.id, status: 'processing' });
    }
    if (record.status === 'failed') {
      return res.status(200).json({ id: record.id, status: 'failed', error: '분석 중 오류가 발생했습니다' });
    }

    const { rows: results } = await pool.query(
      `SELECT result_type, content FROM record_results
       WHERE record_id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const { rows: tags } = await pool.query(
      `SELECT t.id, t.name
       FROM record_tags rt
       JOIN tags t ON t.id = rt.tag_id AND t.deleted_at IS NULL
       WHERE rt.record_id = $1`,
      [id]
    );

    return res.status(200).json({
      id: record.id,
      status: 'done',
      language: record.language,
      results,
      tags,
      created_at: record.created_at,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function listRecords(req, res) {
  const { id: companyId } = req.params;
  try {
    const { exists, hasAccess } = await checkCompanyAccess(companyId, req.user.id);
    if (!exists) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (!hasAccess) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows: records } = await pool.query(
      `SELECT id, input_type, language, status, created_at
       FROM records
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [companyId]
    );

    if (records.length === 0) {
      return res.status(200).json({ records: [] });
    }

    const { rows: tagRows } = await pool.query(
      `SELECT rt.record_id, t.id, t.name
       FROM record_tags rt
       JOIN tags t ON t.id = rt.tag_id AND t.deleted_at IS NULL
       WHERE rt.record_id = ANY($1::uuid[])`,
      [records.map((r) => r.id)]
    );

    const tagsByRecord = {};
    for (const row of tagRows) {
      if (!tagsByRecord[row.record_id]) tagsByRecord[row.record_id] = [];
      tagsByRecord[row.record_id].push({ id: row.id, name: row.name });
    }

    return res.status(200).json({
      records: records.map((r) => ({
        id: r.id,
        input_type: r.input_type,
        language: r.language,
        status: r.status,
        tags: tagsByRecord[r.id] || [],
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function deleteRecord(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT created_by FROM records WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    if (rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    await pool.query(`UPDATE records SET deleted_at = NOW() WHERE id = $1`, [id]);
    return res.status(200).json({ message: '기록이 삭제되었습니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

module.exports = { createRecord, getRecord, listRecords, deleteRecord };
