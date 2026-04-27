const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');
const db   = require('../config/db');
const resp = require('../utils/response');
const { UPLOAD_DIR } = require('../config/multer');

/**
 * POST /content/upload  (teacher only)
 * Multipart: file + body fields
 */
const uploadContent = async (req, res) => {
  // req.file is set by multer middleware in the route
  if (!req.file) return resp.badRequest(res, 'File is required (jpg, png, gif)');

  const { title, subject, description, start_time, end_time, rotation_duration } = req.body;

  if (!title || !title.trim())   return resp.badRequest(res, 'Title is required');
  if (!subject || !subject.trim()) return resp.badRequest(res, 'Subject is required');

  // Validate time window if provided
  let parsedStart = null, parsedEnd = null;
  if (start_time || end_time) {
    parsedStart = start_time ? new Date(start_time) : null;
    parsedEnd   = end_time   ? new Date(end_time)   : null;
    if (parsedStart && isNaN(parsedStart)) return resp.badRequest(res, 'Invalid start_time format');
    if (parsedEnd   && isNaN(parsedEnd))   return resp.badRequest(res, 'Invalid end_time format');
    if (parsedStart && parsedEnd && parsedStart >= parsedEnd) {
      return resp.badRequest(res, 'start_time must be before end_time');
    }
  }

  const rotDuration = rotation_duration ? parseInt(rotation_duration) : 5;
  if (isNaN(rotDuration) || rotDuration < 1) return resp.badRequest(res, 'rotation_duration must be a positive integer (minutes)');

  try {
    const id        = uuidv4();
    const subjectLC = subject.trim().toLowerCase();
    const fileUrl   = `/uploads/${req.file.filename}`;
    const fileType  = req.file.mimetype.split('/')[1].replace('jpeg', 'jpg');

    await db.query(
      `INSERT INTO content
         (id, title, description, subject, file_path, file_url, file_type, file_size,
          uploaded_by, status, start_time, end_time, rotation_duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        id,
        title.trim(),
        description?.trim() || null,
        subjectLC,
        req.file.path,
        fileUrl,
        fileType,
        req.file.size,
        req.user.id,
        parsedStart || null,
        parsedEnd   || null,
        rotDuration,
      ]
    );

    // ── Slot + Schedule registration ────────────────────────────
    // Ensure a slot exists for this teacher+subject
    let slotId;
    const [slots] = await db.query(
      'SELECT id FROM content_slots WHERE teacher_id = ? AND subject = ?',
      [req.user.id, subjectLC]
    );

    if (slots.length) {
      slotId = slots[0].id;
    } else {
      slotId = uuidv4();
      await db.query(
        'INSERT INTO content_slots (id, teacher_id, subject) VALUES (?, ?, ?)',
        [slotId, req.user.id, subjectLC]
      );
    }

    // Determine rotation_order (append to end)
    const [orderRows] = await db.query(
      'SELECT COALESCE(MAX(rotation_order), -1) + 1 AS next_order FROM content_schedule WHERE slot_id = ?',
      [slotId]
    );
    const rotationOrder = orderRows[0].next_order;

    const schedId = uuidv4();
    await db.query(
      'INSERT INTO content_schedule (id, content_id, slot_id, rotation_order, duration) VALUES (?, ?, ?, ?, ?)',
      [schedId, id, slotId, rotationOrder, rotDuration]
    );

    return resp.success(res, {
      id,
      title: title.trim(),
      subject: subjectLC,
      status: 'pending',
      file_url: fileUrl,
      rotation_order: rotationOrder,
    }, 'Content uploaded and pending approval', 201);
  } catch (err) {
    // Clean up uploaded file on DB error
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error('[uploadContent]', err);
    return resp.error(res, 'Content upload failed');
  }
};

/**
 * GET /content/my  (teacher only)
 * Teacher views their own content with optional filters
 */
const getMyContent = async (req, res) => {
  const { status, subject } = req.query;
  const params = [req.user.id];
  let sql = `
    SELECT c.id, c.title, c.description, c.subject, c.file_url, c.file_type,
           c.file_size, c.status, c.rejection_reason, c.start_time, c.end_time,
           c.rotation_duration, c.created_at,
           u.name AS approved_by_name, c.approved_at
    FROM content c
    LEFT JOIN users u ON u.id = c.approved_by
    WHERE c.uploaded_by = ?
  `;
  if (status)  { sql += ' AND c.status = ?';  params.push(status); }
  if (subject) { sql += ' AND c.subject = ?'; params.push(subject.toLowerCase()); }
  sql += ' ORDER BY c.created_at DESC';

  try {
    const [rows] = await db.query(sql, params);
    return resp.success(res, { content: rows, total: rows.length });
  } catch (err) {
    console.error('[getMyContent]', err);
    return resp.error(res, 'Failed to fetch content');
  }
};

/**
 * GET /content/:id  (teacher sees own; principal sees all)
 */
const getContentById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, u.name AS teacher_name, p.name AS approved_by_name
       FROM content c
       JOIN users u ON u.id = c.uploaded_by
       LEFT JOIN users p ON p.id = c.approved_by
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return resp.notFound(res, 'Content not found');

    const content = rows[0];
    // Teachers can only view their own content
    if (req.user.role === 'teacher' && content.uploaded_by !== req.user.id) {
      return resp.forbidden(res);
    }
    return resp.success(res, { content });
  } catch (err) {
    console.error('[getContentById]', err);
    return resp.error(res, 'Failed to fetch content');
  }
};

/**
 * DELETE /content/:id  (teacher deletes own pending content)
 */
const deleteContent = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM content WHERE id = ?', [req.params.id]);
    if (!rows.length) return resp.notFound(res, 'Content not found');

    const content = rows[0];
    if (content.uploaded_by !== req.user.id) return resp.forbidden(res);
    if (content.status === 'approved') return resp.badRequest(res, 'Cannot delete approved content');

    // Remove file
    if (content.file_path && fs.existsSync(content.file_path)) {
      fs.unlinkSync(content.file_path);
    }

    await db.query('DELETE FROM content WHERE id = ?', [req.params.id]);
    return resp.success(res, null, 'Content deleted');
  } catch (err) {
    console.error('[deleteContent]', err);
    return resp.error(res, 'Delete failed');
  }
};

module.exports = { uploadContent, getMyContent, getContentById, deleteContent };
