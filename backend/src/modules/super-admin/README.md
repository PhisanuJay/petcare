# Super Admin / Hotel CCTV

<<<<<<< Updated upstream
**ผู้รับผิดชอบ:** ฟ่าง

โฟลเดอร์ backend ของบทบาทนี้ — คู่กับ `frontend/src/features/super-admin/`
=======
CCTV auth + camera admin อยู่ใน PetCare backend (`/api/cctv-auth`, `/api/cctv-admin`)

## Database

ข้อมูล CCTV อยู่ใน **Microsoft SQL Server** database `PetCare` (ตารางขึ้นต้น `cctv_`)

- `cctv_users`, `cctv_staff_permissions`
- `cctv_cameras`, `cctv_camera_grants`, `cctv_petcare_camera_grants`
- `cctv_stream_sessions`, `cctv_care_logs`

สร้างอัตโนมัติตอน migrate backend  
ย้ายข้อมูลจาก SQLite เก่า: `node scripts/migrate-cctv-sqlite-to-mssql.mjs`

RTSP URL เข้ารหัสด้วย `CAMERA_SECRET` จาก `.env` ของโมดูลนี้

## หมายเหตุ

บริการ streaming / WHEP ภายนอก (พอร์ต 3000) ยังแยกต่างหากตาม `vite.config.js`
>>>>>>> Stashed changes
