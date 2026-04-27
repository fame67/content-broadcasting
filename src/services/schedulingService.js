/**
 * Scheduling / Rotation Service
 * ─────────────────────────────
 * Determines which content item is currently "live" for a given teacher
 * (and optional subject filter) using the following algorithm:
 *
 *   1. Fetch all approved content for the teacher that:
 *        - Have start_time AND end_time set (scheduling is required)
 *        - Are within their active time window  (start_time ≤ NOW ≤ end_time)
 *
 *   2. Group by subject; for each subject:
 *        - Order content by rotation_order (from content_schedule)
 *        - Calculate totalCycleDuration = Σ duration of all items
 *        - elapsedMs = Date.now() % totalCycleMs
 *        - Walk items until cumulative duration covers elapsedMs
 *        - That item is the currently-active content
 *
 * The rotation reference is the Unix epoch — so rotation is deterministic
 * and identical for every client hitting the endpoint at the same moment.
 */

const db = require('../config/db');

/**
 * Fetches the currently active content for a teacher, grouped by subject.
 *
 * @param {string} teacherId   - UUID of the teacher
 * @param {string|null} subject - Optional subject filter (lowercase)
 * @returns {Promise<Object>}   - { [subject]: contentRow | null }
 */
async function getActiveBroadcast(teacherId, subject = null) {
  // ── 1. Fetch eligible content (approved + inside time window) ──
  const params = [teacherId];
  let sql = `
    SELECT
      c.id, c.title, c.description, c.subject,
      c.file_url, c.file_type, c.file_size,
      c.start_time, c.end_time, c.rotation_duration,
      c.approved_at,
      u.name  AS teacher_name,
      cs.rotation_order,
      cs.duration,
      cs.slot_id
    FROM content c
    JOIN content_schedule cs ON cs.content_id = c.id
    JOIN content_slots    sl ON sl.id          = cs.slot_id
    JOIN users            u  ON u.id           = c.uploaded_by
    WHERE c.uploaded_by = ?
      AND c.status      = 'approved'
      AND c.start_time  IS NOT NULL
      AND c.end_time    IS NOT NULL
      AND NOW() BETWEEN c.start_time AND c.end_time
  `;

  if (subject) {
    sql += ' AND c.subject = ?';
    params.push(subject);
  }

  sql += ' ORDER BY c.subject, cs.rotation_order ASC';

  const [rows] = await db.query(sql, params);

  if (!rows.length) return {};

  // ── 2. Group by subject ─────────────────────────────────────────
  const bySubject = {};
  for (const row of rows) {
    if (!bySubject[row.subject]) bySubject[row.subject] = [];
    bySubject[row.subject].push(row);
  }

  // ── 3. Determine active item per subject ────────────────────────
  const result = {};
  const nowMs  = Date.now();

  for (const [subj, items] of Object.entries(bySubject)) {
    if (items.length === 1) {
      // Only one item — it's always active within the time window
      result[subj] = sanitize(items[0]);
      continue;
    }

    // Total cycle duration in milliseconds
    const totalMs = items.reduce((sum, item) => sum + item.duration * 60 * 1000, 0);

    if (totalMs === 0) {
      result[subj] = sanitize(items[0]);
      continue;
    }

    // Position within the current cycle (epoch-based, deterministic)
    const positionMs = nowMs % totalMs;

    let accumulated = 0;
    let activeItem  = items[0]; // fallback

    for (const item of items) {
      const itemMs = item.duration * 60 * 1000;
      if (positionMs < accumulated + itemMs) {
        activeItem = item;
        break;
      }
      accumulated += itemMs;
    }

    result[subj] = sanitize(activeItem);
  }

  return result;
}

/**
 * Returns live content for a single teacher endpoint.
 * If subject is given → returns { subject: item }
 * Otherwise           → returns { subject1: item, subject2: item, ... }
 *
 * Edge cases return an empty object {}.
 */
async function getLiveContent(teacherId, subject = null) {
  try {
    return await getActiveBroadcast(teacherId, subject);
  } catch (err) {
    console.error('[schedulingService]', err);
    return {};
  }
}

/**
 * Strip DB-internal fields before sending to the public API.
 */
function sanitize(item) {
  return {
    id:           item.id,
    title:        item.title,
    description:  item.description || null,
    subject:      item.subject,
    file_url:     item.file_url,
    file_type:    item.file_type,
    teacher_name: item.teacher_name,
    active_until: item.end_time,
    rotation_slot: item.rotation_order + 1,
  };
}

module.exports = { getLiveContent };
