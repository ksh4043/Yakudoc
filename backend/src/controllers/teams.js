const pool = require('../db/pool');

async function getTeams(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.created_at,
              COUNT(u.id) FILTER (WHERE u.deleted_at IS NULL) AS member_count,
              COUNT(u.id) FILTER (WHERE u.deleted_at IS NULL AND u.team_role = 'lead') AS lead_count
       FROM teams t
       LEFT JOIN users u ON u.team_id = t.id
       WHERE t.deleted_at IS NULL
       GROUP BY t.id
       ORDER BY t.created_at DESC`
    );
    return res.status(200).json({
      teams: rows.map((r) => ({
        id: r.id,
        name: r.name,
        member_count: Number(r.member_count),
        lead_count: Number(r.lead_count),
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function createTeam(req, res) {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO teams (name) VALUES ($1) RETURNING id, name`,
      [name]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function updateTeam(req, res) {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE teams SET name = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, name`,
      [name, id]
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

async function deleteTeam(req, res) {
  const { id } = req.params;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE teams SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }

    await client.query(
      `UPDATE users SET team_id = NULL, team_role = 'member' WHERE team_id = $1 AND deleted_at IS NULL`,
      [id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ message: '팀이 삭제되었습니다' });
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

async function getTeamMembers(req, res) {
  const { id } = req.params;
  try {
    const { rows: teams } = await pool.query(
      `SELECT id FROM teams WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!teams[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }

    const { rows: members } = await pool.query(
      `SELECT id AS user_id, name, email, team_role
       FROM users
       WHERE team_id = $1 AND deleted_at IS NULL
       ORDER BY name`,
      [id]
    );
    return res.status(200).json({ members });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function addTeamMember(req, res) {
  const { id } = req.params;
  const { user_id, team_role } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  const role = team_role || 'member';
  if (!['member', 'lead'].includes(role)) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows: teams } = await pool.query(
      `SELECT id FROM teams WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!teams[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }

    const { rows: users } = await pool.query(
      `SELECT id, team_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [user_id]
    );
    if (!users[0]) {
      return res.status(404).json({ error: '존재하지 않는 사용자입니다' });
    }
    if (users[0].team_id) {
      return res.status(409).json({ error: '이미 다른 팀에 소속된 사용자입니다' });
    }

    await pool.query(
      `UPDATE users SET team_id = $1, team_role = $2 WHERE id = $3`,
      [id, role, user_id]
    );
    return res.status(201).json({ team_id: id, user_id, team_role: role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function updateTeamMemberRole(req, res) {
  const { id, userId } = req.params;
  const { team_role } = req.body;
  if (!['member', 'lead'].includes(team_role)) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET team_role = $1
       WHERE id = $2 AND team_id = $3 AND deleted_at IS NULL
       RETURNING id AS user_id, team_role`,
      [team_role, userId, id]
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

async function removeTeamMember(req, res) {
  const { id, userId } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET team_id = NULL, team_role = 'member'
       WHERE id = $1 AND team_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [userId, id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }
    return res.status(200).json({ message: '팀에서 제외되었습니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function getTeamBoard(req, res) {
  const { id } = req.params;
  try {
    const { rows: teams } = await pool.query(
      `SELECT id, name FROM teams WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!teams[0]) {
      return res.status(404).json({ error: '존재하지 않는 리소스입니다' });
    }

    const { rows: requester } = await pool.query(
      `SELECT team_id, team_role FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.id]
    );
    if (!requester[0] || requester[0].team_id !== id || requester[0].team_role !== 'lead') {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const { rows: members } = await pool.query(
      `SELECT id AS user_id, name, team_role
       FROM users
       WHERE team_id = $1 AND deleted_at IS NULL
       ORDER BY name`,
      [id]
    );

    const { rows: companies } = await pool.query(
      `SELECT c.id, c.name
       FROM companies c
       JOIN users u ON u.id = c.owner_id
       WHERE u.team_id = $1 AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [id]
    );

    let assigneesByCompany = {};
    if (companies.length > 0) {
      const { rows: assigneeRows } = await pool.query(
        `SELECT cm.company_id, cm.user_id, u.name, cm.permission
         FROM company_members cm
         JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL
         WHERE cm.company_id = ANY($1::uuid[]) AND cm.deleted_at IS NULL`,
        [companies.map((c) => c.id)]
      );
      assigneesByCompany = assigneeRows.reduce((acc, row) => {
        if (!acc[row.company_id]) acc[row.company_id] = [];
        acc[row.company_id].push({ user_id: row.user_id, name: row.name, permission: row.permission });
        return acc;
      }, {});
    }

    return res.status(200).json({
      team: teams[0],
      members,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        assignees: assigneesByCompany[c.id] || [],
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

module.exports = {
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  getTeamBoard,
};
