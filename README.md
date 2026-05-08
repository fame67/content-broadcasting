# Content Broadcasting System

A backend system that allows teachers to upload educational content which, once approved by the Principal, is broadcasted via a public API to students. Supports subject-based scheduling and rotation.

## Tech Stack

| Layer        | Technology                    |
|--------------|-------------------------------|
| Runtime      | Node.js 18+                   |
| Framework    | Express.js                    |
| Database     | MySQL 8+                      |
| Auth         | JWT (jsonwebtoken) + bcryptjs |
| File Upload  | Multer (disk storage)         |
| Validation   | Joi                           |
| Rate Limit   | express-rate-limit            |
| Security     | Helmet, CORS                  |

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- MySQL 8 running locally

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd content-broadcasting-system
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secret
```

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=content_broadcasting
JWT_SECRET=change_this_to_something_long_and_random
JWT_EXPIRES_IN=7d
MAX_FILE_SIZE_MB=10
UPLOAD_DIR=uploads
```

### 3. Initialise Database

```bash
npm run db:init
```

This creates the database, all tables, and seeds 3 demo users:

| Email                    | Password    | Role      |
|--------------------------|-------------|-----------|
| principal@school.com     | password123 | principal |
| alice@school.com         | password123 | teacher   |
| bob@school.com           | password123 | teacher   |

### 4. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:3000`

---

## API Reference

> All protected endpoints require: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint         | Auth     | Description           |
|--------|------------------|----------|-----------------------|
| POST   | /auth/register   | Public   | Register a new user   |
| POST   | /auth/login      | Public   | Login, receive token  |
| GET    | /auth/me         | Required | Get current user      |

#### POST /auth/register
```json
{
  "name": "Teacher Alice",
  "email": "alice@school.com",
  "password": "securepassword",
  "role": "teacher"
}
```

#### POST /auth/login
```json
{
  "email": "alice@school.com",
  "password": "securepassword"
}
```
**Response:** `{ "token": "...", "user": { "id", "name", "email", "role" } }`

---

### Content (Teacher)

| Method | Endpoint          | Auth    | Role    | Description               |
|--------|-------------------|---------|---------|---------------------------|
| POST   | /content/upload   | Required | teacher | Upload content (multipart)|
| GET    | /content/my       | Required | teacher | View own content          |
| GET    | /content/:id      | Required | both    | Get content by ID         |
| DELETE | /content/:id      | Required | teacher | Delete pending content    |

#### POST /content/upload
`Content-Type: multipart/form-data`

| Field             | Type   | Required | Description                              |
|-------------------|--------|----------|------------------------------------------|
| file              | File   | ✅       | JPG / PNG / GIF, max 10MB               |
| title             | String | ✅       | Content title                            |
| subject           | String | ✅       | e.g. maths, science, english             |
| description       | String | ❌       | Optional description                     |
| start_time        | ISO 8601 | ❌    | When content becomes visible             |
| end_time          | ISO 8601 | ❌    | When content stops being visible         |
| rotation_duration | Number | ❌       | Minutes per slot (default: 5)            |

> **Important:** Content without `start_time` AND `end_time` will never be broadcasted even if approved.

#### GET /content/my
Query params: `?status=pending|approved|rejected` `&subject=maths`

---

### Approval (Principal Only)

| Method | Endpoint                          | Description                  |
|--------|-----------------------------------|------------------------------|
| GET    | /approval/content                 | List all content              |
| PATCH  | /approval/content/:id/approve     | Approve content               |
| PATCH  | /approval/content/:id/reject      | Reject with reason            |

#### GET /approval/content
Query params: `?status=pending` `&subject=maths` `&teacher_id=<uuid>` `&page=1&limit=20`

#### PATCH /approval/content/:id/reject
```json
{ "reason": "Content is not relevant to the curriculum" }
```

---

### Public Broadcast API (No Auth Required)

| Method | Endpoint                        | Description                              |
|--------|---------------------------------|------------------------------------------|
| GET    | /content/live                   | All live content across all teachers     |
| GET    | /content/live/:teacherId        | Live content for a specific teacher      |
| GET    | /content/live/:teacherId?subject=maths | Filtered by subject             |

#### Response — content available
```json
{
  "success": true,
  "data": {
    "teacher_id": "uuid",
    "teacher_name": "Teacher Alice",
    "subjects": {
      "maths": {
        "id": "uuid",
        "title": "Algebra Worksheet",
        "subject": "maths",
        "file_url": "/uploads/1234567890-abc.jpg",
        "file_type": "jpg",
        "teacher_name": "Teacher Alice",
        "active_until": "2026-04-28T18:00:00Z",
        "rotation_slot": 2
      }
    }
  }
}
```

#### Response — no content
```json
{
  "success": true,
  "data": {
    "teacher_id": "uuid",
    "teacher_name": "Teacher Alice",
    "message": "No content available",
    "content": null
  }
}
```

---

## Content Lifecycle

```
Teacher uploads → status: pending
                     ↓
             Principal reviews
            /                \
    status: approved      status: rejected
                              + rejection_reason
                              + visible to teacher
         ↓
  Live only when:
    - approved ✅
    - start_time set ✅
    - end_time set ✅
    - NOW() between start_time and end_time ✅
```

## Scheduling / Rotation Logic

Each subject per teacher has its own independent rotation:

```
Teacher Alice — Maths:
  Content A (5 min) → Content B (10 min) → Content C (5 min) → loops...

  totalCycleMs = (5 + 10 + 5) × 60 × 1000 = 1,200,000 ms
  positionMs   = Date.now() % 1,200,000

  0–300000ms   → Content A is live
  300000–900000ms → Content B is live
  900000–1200000ms → Content C is live
  → cycle repeats
```

The rotation is **epoch-based** and **deterministic** — every student hitting the endpoint at the same time sees the same content.

---

## Edge Cases

| Case                              | Response                   |
|-----------------------------------|----------------------------|
| No approved content               | "No content available"     |
| Approved but no time window set   | "No content available"     |
| Outside time window               | "No content available"     |
| Invalid/unknown teacher ID        | "No content available"     |
| Invalid subject filter            | "No content available"     |
| Wrong file type (not jpg/png/gif) | 400 Bad Request            |
| File > 10MB                       | 400 Bad Request            |
| Missing required fields           | 400 with field errors      |

---

## Folder Structure

```
content-broadcasting-system/
├── src/
│   ├── controllers/
│   │   ├── authController.js       # Register, login, me
│   │   ├── contentController.js    # Teacher upload, view, delete
│   │   ├── approvalController.js   # Principal approve/reject
│   │   └── broadcastController.js  # Public live content API
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── contentRoutes.js
│   │   ├── approvalRoutes.js
│   │   └── broadcastRoutes.js
│   ├── services/
│   │   └── schedulingService.js    # ⭐ Core rotation algorithm
│   ├── middlewares/
│   │   ├── auth.js                 # JWT verification
│   │   ├── rbac.js                 # Role-based access control
│   │   ├── validate.js             # Joi schema validation
│   │   └── errorHandler.js        # Global error handler
│   ├── config/
│   │   ├── db.js                   # MySQL connection pool
│   │   └── multer.js               # File upload configuration
│   └── utils/
│       └── response.js             # Standardized API responses
├── database/
│   ├── schema.sql                  # Full DDL for all tables
│   └── init.js                     # Init script with seed data
├── uploads/                        # Local file storage (gitignored)
├── server.js                       # Entry point
├── architecture-notes.txt          # System design documentation
├── .env.example
└── package.json
```

---

## Assumptions & Notes

- Subjects are stored and compared **case-insensitively** (lowercased).
- Content without `start_time`/`end_time` is **never** broadcasted — teacher must define a schedule.
- Rotation position is calculated from Unix epoch — deterministic, no DB polling needed.
- `rotation_duration` on the content row and `duration` on the schedule row are kept in sync on upload. Future UI can allow per-schedule overrides.
- The `DELETE /content/:id` endpoint only allows deleting `pending` or `rejected` content — approved content cannot be deleted to maintain audit trail.
- Principal can register via `/auth/register` with `role: "principal"`. In a production system, this route would be restricted or admin-seeded only.
## Live Demo
https://content-broadcasting-production.up.railway.app/health

// checking
