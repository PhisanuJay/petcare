import { exec, queryOne, run } from '../../db/mssql.js';

/** CCTV tables prefixed with cctv_ to avoid clash with PetCare dbo.users */
export const SCHEMA_CCTV = `
IF OBJECT_ID(N'dbo.cctv_users', N'U') IS NULL
CREATE TABLE dbo.cctv_users (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  email NVARCHAR(200) NOT NULL,
  password_hash NVARCHAR(200) NOT NULL,
  role NVARCHAR(50) NOT NULL,
  display_name NVARCHAR(200) NOT NULL CONSTRAINT DF_cctv_users_display_name DEFAULT (N''),
  is_active BIT NOT NULL CONSTRAINT DF_cctv_users_is_active DEFAULT (1),
  created_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.cctv_staff_permissions', N'U') IS NULL
CREATE TABLE dbo.cctv_staff_permissions (
  user_id INT NOT NULL PRIMARY KEY,
  view_cameras BIT NOT NULL CONSTRAINT DF_cctv_sp_view_cameras DEFAULT (0),
  manage_cameras BIT NOT NULL CONSTRAINT DF_cctv_sp_manage_cameras DEFAULT (0),
  care_logs BIT NOT NULL CONSTRAINT DF_cctv_sp_care_logs DEFAULT (0),
  manage_customers BIT NOT NULL CONSTRAINT DF_cctv_sp_manage_customers DEFAULT (0),
  manage_grants BIT NOT NULL CONSTRAINT DF_cctv_sp_manage_grants DEFAULT (0),
  manage_rooms BIT NOT NULL CONSTRAINT DF_cctv_sp_manage_rooms DEFAULT (0),
  view_logs BIT NOT NULL CONSTRAINT DF_cctv_sp_view_logs DEFAULT (0),
  view_settings BIT NOT NULL CONSTRAINT DF_cctv_sp_view_settings DEFAULT (0),
  CONSTRAINT FK_cctv_staff_permissions_user FOREIGN KEY (user_id) REFERENCES dbo.cctv_users(id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.cctv_cameras', N'U') IS NULL
CREATE TABLE dbo.cctv_cameras (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  description NVARCHAR(500) NOT NULL CONSTRAINT DF_cctv_cameras_description DEFAULT (N''),
  room_label NVARCHAR(120) NOT NULL CONSTRAINT DF_cctv_cameras_room_label DEFAULT (N''),
  cat_name NVARCHAR(120) NOT NULL CONSTRAINT DF_cctv_cameras_cat_name DEFAULT (N''),
  is_enabled BIT NOT NULL CONSTRAINT DF_cctv_cameras_is_enabled DEFAULT (1),
  stream_status NVARCHAR(50) NOT NULL CONSTRAINT DF_cctv_cameras_stream_status DEFAULT (N'offline'),
  last_error NVARCHAR(500) NULL,
  last_seen_at NVARCHAR(40) NULL,
  rtsp_url_enc NVARCHAR(MAX) NOT NULL,
  rtsp_fingerprint NVARCHAR(128) NOT NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.cctv_camera_grants', N'U') IS NULL
CREATE TABLE dbo.cctv_camera_grants (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  camera_id INT NOT NULL,
  user_id INT NOT NULL,
  pet_name NVARCHAR(120) NULL,
  room_label NVARCHAR(120) NULL,
  starts_at NVARCHAR(40) NOT NULL,
  ends_at NVARCHAR(40) NOT NULL,
  revoked_at NVARCHAR(40) NULL,
  created_at NVARCHAR(40) NOT NULL,
  CONSTRAINT FK_cctv_camera_grants_camera FOREIGN KEY (camera_id) REFERENCES dbo.cctv_cameras(id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.cctv_petcare_camera_grants', N'U') IS NULL
CREATE TABLE dbo.cctv_petcare_camera_grants (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  camera_id INT NOT NULL,
  owner_id NVARCHAR(64) NOT NULL,
  owner_email NVARCHAR(200) NOT NULL,
  owner_name NVARCHAR(200) NOT NULL,
  pet_name NVARCHAR(120) NULL,
  room_label NVARCHAR(120) NULL,
  starts_at NVARCHAR(40) NOT NULL,
  ends_at NVARCHAR(40) NOT NULL,
  revoked_at NVARCHAR(40) NULL,
  created_at NVARCHAR(40) NOT NULL,
  CONSTRAINT FK_cctv_petcare_grants_camera FOREIGN KEY (camera_id) REFERENCES dbo.cctv_cameras(id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.cctv_stream_sessions', N'U') IS NULL
CREATE TABLE dbo.cctv_stream_sessions (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  user_id INT NULL,
  camera_id INT NOT NULL,
  grant_id INT NULL,
  token_hash NVARCHAR(128) NOT NULL,
  expires_at NVARCHAR(40) NOT NULL,
  revoked_at NVARCHAR(40) NULL,
  created_at NVARCHAR(40) NOT NULL,
  CONSTRAINT FK_cctv_stream_sessions_camera FOREIGN KEY (camera_id) REFERENCES dbo.cctv_cameras(id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.cctv_care_logs', N'U') IS NULL
CREATE TABLE dbo.cctv_care_logs (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  camera_id INT NOT NULL,
  kind NVARCHAR(50) NOT NULL,
  note NVARCHAR(1000) NULL,
  logged_at NVARCHAR(40) NOT NULL,
  created_by INT NULL,
  CONSTRAINT FK_cctv_care_logs_camera FOREIGN KEY (camera_id) REFERENCES dbo.cctv_cameras(id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_cctv_users_email' AND object_id = OBJECT_ID(N'dbo.cctv_users'))
  CREATE UNIQUE INDEX UQ_cctv_users_email ON dbo.cctv_users(email);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_cctv_cameras_fingerprint' AND object_id = OBJECT_ID(N'dbo.cctv_cameras'))
  CREATE UNIQUE INDEX UQ_cctv_cameras_fingerprint ON dbo.cctv_cameras(rtsp_fingerprint);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cctv_petcare_grants_owner' AND object_id = OBJECT_ID(N'dbo.cctv_petcare_camera_grants'))
  CREATE INDEX idx_cctv_petcare_grants_owner ON dbo.cctv_petcare_camera_grants(owner_id, owner_email, revoked_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cctv_camera_grants_camera' AND object_id = OBJECT_ID(N'dbo.cctv_camera_grants'))
  CREATE INDEX idx_cctv_camera_grants_camera ON dbo.cctv_camera_grants(camera_id);
`;

const SUPER_ADMIN_EMAIL = 'superadmin@petcare.local';
/** bcrypt of "1234" */
const SUPER_ADMIN_PASSWORD_HASH = '$2a$10$PDYkakNbG6IIGKozNzBsg.sZBh0gwiaullP9HNDQcK.kVL9r19pbO';

export async function migrateCctv() {
  await exec(SCHEMA_CCTV);
  const admin = await queryOne(
    `SELECT TOP 1 id, email FROM dbo.cctv_users WHERE role = N'admin' AND is_active = 1 ORDER BY id`,
  );
  if (!admin) {
    const now = new Date().toISOString();
    await run(
      `INSERT INTO dbo.cctv_users (email, password_hash, role, display_name, is_active, created_at)
       VALUES (?, ?, N'admin', N'Super Admin', 1, ?)`,
      [SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD_HASH, now],
    );
    return;
  }

  if (String(admin.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL) {
    await run(
      `UPDATE dbo.cctv_users
       SET email = ?, password_hash = ?, display_name = N'Super Admin'
       WHERE id = ?`,
      [SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD_HASH, admin.id],
    );
  }
}

export async function cctvReady() {
  const row = await queryOne(`SELECT OBJECT_ID(N'dbo.cctv_cameras', N'U') AS id`);
  return Boolean(row?.id);
}
