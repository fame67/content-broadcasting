const db   = require('../config/db');
const resp = require('../utils/response');

/**
 * GET /approval/content          — list all content (principal)
 * GET /approval/content?status=pending  — filter by status
 */
const listAllContent = async (req, res) => {
  const { status, subject, teacher_id, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];

  let sql = `
    SELECT c.id, c.title, c.description, c.subject, c.file_url, c.file_type,
           c.file_size, c.status, c.rejection_reason, c.start_time, c.end_time,
           c.rotation_duration, c.created_at, c.approved_at,
           u.id   AS teacher_id, u.name AS teacher_name, u.email AS teacher_email,
           p.name AS approved_by_name
    FROM content c
    JOIN  users u ON u.id = c.uploaded_by
    LEFT JOIN users p ON p.id = c.approved_by
    WHERE 1=1
  `;

  if (status)     { sql += ' AND c.status = ?';      params.push(status); }
  if (subject)    { sql += ' AND c.subject = ?';     params.push(subject.toLowerCase()); }
  if (teacher_id) { sql += ' AND c.uploaded_by = ?'; params.push(teacher_id); }

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  try {
    const [rows]  = await db.query(sql, params);
    const [count] = await db.query(
      'SELECT COUNT(*) AS total FROM content c WHERE 1=1' +
      (status     ? ' AND c.status = ?'      : '') +
      (subject    ? ' AND c.subject = ?'     : '') +
      (teacher_id ? ' AND c.uploaded_by = ?' : ''),
      params.slice(0, -2)
    );
    return resp.success(res, {
      content: rows,
      total:   count[0].total,
      page:    parseInt(page),
      limit:   parseInt(limit),
    });
  } catch (err) {
    console.error('[listAllContent]', err);
    return resp.error(res, 'Failed to fetch content');
  }
};

/**
 * PATCH /approval/content/:id/approve  (principal only)
 */
const approveContent = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM content WHERE id = ?', [req.params.id]);
    if (!rows.length) return resp.notFound(res, 'Content not found');

    const content = rows[0];
    if (content.status === 'approved') return resp.badRequest(res, 'Content is already approved');

    await db.query(
      `UPDATE content
       SET status = 'approved', approved_by = ?, approved_at = NOW(), rejection_reason = NULL
       WHERE id = ?`,
      [req.user.id, content.id]
    );

    return resp.success(res, { id: content.id, status: 'approved' }, 'Content approved');
  } catch (err) {
    console.error('[approveContent]', err);
    return resp.error(res, 'Approval failed');
  }
};

/**
 * PATCH /approval/content/:id/reject  (principal only)
 * Body: { reason }
 */
const rejectContent = async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) return resp.badRequest(res, 'Rejection reason is required');

  try {
    const [rows] = await db.query('SELECT * FROM content WHERE id = ?', [req.params.id]);
    if (!rows.length) return resp.notFound(res, 'Content not found');

    const content = rows[0];
    if (content.status === 'rejected') return resp.badRequest(res, 'Content is already rejected');

    await db.query(
      `UPDATE content
       SET status = 'rejected', rejection_reason = ?, approved_by = NULL, approved_at = NULL
       WHERE id = ?`,
      [reason.trim(), content.id]
    );

    return resp.success(res, { id: content.id, status: 'rejected', reason: reason.trim() }, 'Content rejected');
  } catch (err) {
    console.error('[rejectContent]', err);
    return resp.error(res, 'Rejection failed');
  }
};

module.exports = { listAllContent, approveContent, rejectContent };
