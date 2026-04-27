const db   = require('../config/db');
const resp = require('../utils/response');
const { getLiveContent } = require('../services/schedulingService');

/**
 * GET /content/live/:teacherId
 * GET /content/live/:teacherId?subject=maths
 *
 * Public endpoint — no auth required.
 * Returns currently-active approved content for the given teacher.
 */
const getLiveForTeacher = async (req, res) => {
  const { teacherId } = req.params;
  const { subject }   = req.query;

  try {
    // ── Validate teacher exists ─────────────────────────────────
    const [users] = await db.query(
      "SELECT id, name FROM users WHERE id = ? AND role = 'teacher'",
      [teacherId]
    );
    if (!users.length) {
      // Per spec: invalid teacher → return empty, not error
      return resp.success(res, { message: 'No content available', content: null });
    }

    const teacher      = users[0];
    const subjectFilter = subject ? subject.trim().toLowerCase() : null;

    // ── Run scheduling logic ────────────────────────────────────
    const liveBySubject = await getLiveContent(teacherId, subjectFilter);

    if (!Object.keys(liveBySubject).length) {
      return resp.success(res, {
        teacher_id:   teacherId,
        teacher_name: teacher.name,
        message:      'No content available',
        content:      null,
      });
    }

    // If subject filter → return single item; else return all subjects
    if (subjectFilter) {
      const item = liveBySubject[subjectFilter];
      if (!item) {
        return resp.success(res, {
          teacher_id:   teacherId,
          teacher_name: teacher.name,
          subject:      subjectFilter,
          message:      'No content available',
          content:      null,
        });
      }
      return resp.success(res, {
        teacher_id:   teacherId,
        teacher_name: teacher.name,
        subject:      subjectFilter,
        content:      item,
      });
    }

    // Return all subjects
    return resp.success(res, {
      teacher_id:   teacherId,
      teacher_name: teacher.name,
      subjects:     liveBySubject,
    });
  } catch (err) {
    console.error('[getLiveForTeacher]', err);
    return resp.error(res, 'Broadcast fetch failed');
  }
};

/**
 * GET /content/live
 * Returns live content across ALL teachers (summary view)
 * Optional: ?subject=maths
 */
const getAllLive = async (req, res) => {
  const { subject } = req.query;

  try {
    const [teachers] = await db.query(
      "SELECT id, name FROM users WHERE role = 'teacher'"
    );

    const result = [];
    for (const teacher of teachers) {
      const subjectFilter = subject ? subject.trim().toLowerCase() : null;
      const liveBySubject = await getLiveContent(teacher.id, subjectFilter);
      if (Object.keys(liveBySubject).length) {
        result.push({ teacher_id: teacher.id, teacher_name: teacher.name, subjects: liveBySubject });
      }
    }

    if (!result.length) {
      return resp.success(res, { message: 'No content available', broadcast: [] });
    }

    return resp.success(res, { broadcast: result });
  } catch (err) {
    console.error('[getAllLive]', err);
    return resp.error(res, 'Broadcast fetch failed');
  }
};

module.exports = { getLiveForTeacher, getAllLive };
