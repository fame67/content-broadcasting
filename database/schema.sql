-- Content Broadcasting System - MySQL Schema
-- Run this file to initialize the database

CREATE DATABASE IF NOT EXISTS content_broadcasting;
USE content_broadcasting;

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role        ENUM('principal', 'teacher') NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
);

-- ============================================================
-- CONTENT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS content (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  title            VARCHAR(255)  NOT NULL,
  description      TEXT,
  subject          VARCHAR(100)  NOT NULL,
  file_path        VARCHAR(500)  NOT NULL,
  file_url         VARCHAR(500)  NOT NULL,
  file_type        VARCHAR(20)   NOT NULL,   -- jpg | png | gif
  file_size        INT           NOT NULL,   -- bytes
  uploaded_by      VARCHAR(36)   NOT NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by      VARCHAR(36),
  approved_at      DATETIME,
  start_time       DATETIME,                -- teacher-defined window start
  end_time         DATETIME,                -- teacher-defined window end
  rotation_duration INT DEFAULT 5,          -- minutes per slot in rotation
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_content_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uploaded_by (uploaded_by),
  INDEX idx_status      (status),
  INDEX idx_subject     (subject),
  INDEX idx_time_window (start_time, end_time)
);

-- ============================================================
-- CONTENT SLOTS TABLE  (subject-level broadcast slot)
-- ============================================================
CREATE TABLE IF NOT EXISTS content_slots (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  teacher_id VARCHAR(36)  NOT NULL,
  subject    VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_slot_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_teacher_subject (teacher_id, subject),
  INDEX idx_slot_teacher (teacher_id)
);

-- ============================================================
-- CONTENT SCHEDULE TABLE  (maps content → slot with ordering)
-- ============================================================
CREATE TABLE IF NOT EXISTS content_schedule (
  id              VARCHAR(36) NOT NULL PRIMARY KEY,
  content_id      VARCHAR(36) NOT NULL,
  slot_id         VARCHAR(36) NOT NULL,
  rotation_order  INT         NOT NULL DEFAULT 0,
  duration        INT         NOT NULL DEFAULT 5,  -- minutes
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_content FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_slot    FOREIGN KEY (slot_id)    REFERENCES content_slots(id) ON DELETE CASCADE,
  UNIQUE KEY uq_slot_order (slot_id, rotation_order),
  INDEX idx_schedule_slot (slot_id)
);
