-- ═══════════════════════════════════════════════════════════════
--  mysql_setup.sql — MediQueue Hospital Queue System
--  Run this file once in MySQL before starting the server.
--  Sequelize will sync/create the tables automatically,
--  but this script ensures the DB and user exist.
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS hospital_queue_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. (Optional) Create a dedicated DB user
--    Replace 'your_password' with a strong password
--    Skip this block if you're using the root user directly.
CREATE USER IF NOT EXISTS 'hq_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON hospital_queue_db.* TO 'hq_user'@'localhost';
FLUSH PRIVILEGES;

-- 3. Use the database
USE hospital_queue_db;

-- ── The following tables are auto-created by Sequelize sync ──
-- You do NOT need to run the CREATE TABLE statements below;
-- they are here only for reference / manual inspection.

/*
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  photo_url   TEXT,
  role        ENUM('patient','doctor','admin') DEFAULT 'patient',
  createdAt   DATETIME NOT NULL,
  updatedAt   DATETIME NOT NULL
);

CREATE TABLE opd_cards (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  card_number  VARCHAR(20) NOT NULL UNIQUE,
  blood_group  VARCHAR(5),
  age          INT,
  gender       ENUM('Male','Female','Other'),
  phone        VARCHAR(15),
  address      TEXT,
  is_active    TINYINT(1) DEFAULT 1,
  createdAt    DATETIME NOT NULL,
  updatedAt    DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tokens (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  token_number   INT NOT NULL,
  department     ENUM('General','ENT','Cardiology','Orthopedics','Pediatrics') DEFAULT 'General',
  room_number    VARCHAR(10),
  qr_code        LONGTEXT,
  status         ENUM('waiting','called','completed','cancelled') DEFAULT 'waiting',
  estimated_time INT,
  tokens_ahead   INT DEFAULT 0,
  called_at      DATETIME,
  completed_at   DATETIME,
  createdAt      DATETIME NOT NULL,
  updatedAt      DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE opd_visits (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  opd_id         INT NOT NULL,
  token_id       INT,
  symptoms       TEXT NOT NULL,
  diagnosis      TEXT,
  prescription   TEXT,
  doctor_name    VARCHAR(100),
  follow_up_date DATE,
  visit_date     DATE DEFAULT (CURDATE()),
  createdAt      DATETIME NOT NULL,
  updatedAt      DATETIME NOT NULL,
  FOREIGN KEY (opd_id)   REFERENCES opd_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (token_id) REFERENCES tokens(id)    ON DELETE SET NULL
);

CREATE TABLE queues (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  department    ENUM('General','ENT','Cardiology','Orthopedics','Pediatrics') DEFAULT 'General',
  current_token INT DEFAULT 0,
  room_number   VARCHAR(10),
  is_active     TINYINT(1) DEFAULT 1,
  doctor_name   VARCHAR(100),
  createdAt     DATETIME NOT NULL,
  updatedAt     DATETIME NOT NULL
);
*/

-- 4. Seed: default queue rows (one per department)
--    Sequelize sync won't seed these; run them manually if desired.
INSERT IGNORE INTO queues (department, current_token, room_number, is_active, createdAt, updatedAt) VALUES
  ('General',     0, 'OPD-101', 1, NOW(), NOW()),
  ('ENT',         0, 'OPD-205', 1, NOW(), NOW()),
  ('Cardiology',  0, 'OPD-310', 1, NOW(), NOW()),
  ('Orthopedics', 0, 'OPD-412', 1, NOW(), NOW()),
  ('Pediatrics',  0, 'OPD-115', 1, NOW(), NOW());
