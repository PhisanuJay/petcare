# PetCare Backend

API แยกตามบทบาท (คู่กับ `frontend/src/features/`)

```text
src/
  server.js
  routes/index.js      # รวม mount /api/<role>
  modules/
    auth/              # สมัคร/เข้าสู่ระบบสมาชิกและ session
    pet-owner/         # มะแอ่ว
    veterinarian/      # มะแอ่ว
    medical-assistant/ # เอิร์ท
    pet-profile/       # เอิร์ท, ปร่ย
    pet-hotel/         # ฟ่าง, เจ
    pet-transport/     # โมเดล
    adoption/          # ปร่ย
    admin/             # เจ
    super-admin/       # ฟ่าง
```

```powershell
cd backend
npm install
npm run dev
```

Seed กิจกรรมย้อนหลัง (วันนี้ + 3 วันก่อน — คลินิก / รับส่ง / โรงแรม / บัญชี / หาบ้าน) แบบ idempotent:

```powershell
cd backend
node scripts/seed-activity.js
```

รันหลัง backend พร้อม MSSQL แล้ว แล้วรีสตาร์ท `npm run dev` / รีเฟรช dashboard

Super Admin (Bearer ของ `superadmin@petcare.local` / `1234`):

- `GET /api/super-admin/overview` — KPI จริงทั้งระบบ
- `GET /api/super-admin/users` — รายชื่อจาก `dbo.users`
- `GET /api/super-admin/reports` — สรุป + รายการล่าสุด
- CCTV ยังอยู่ที่ `/api/cctv-admin` และ `/api/cctv-auth` (หน้า UI: `/super-admin/cctv`)

ใบจองโรงแรม + มอบสิทธิ์กล้อง (หลัง login CCTV / Super Admin):

- `GET /api/cctv-admin/stays` — ใบจองจริงจาก `hotel_stays`
- `PATCH /api/cctv-admin/stays/:id/status` — รับเข้าพัก / รับกลับ
- `POST /api/cctv-admin/stays/:id/grants` — มอบสิทธิ์ดูกล้องให้ผู้จอง (idempotent)
- Seed สิทธิ์ตัวอย่าง: `node scripts/seed-hotel-cctv-grants.js`

ค่าเริ่มต้น: `http://localhost:3001` — health ที่ `/health`

บัญชีทุกบทบาท (รวมหาบ้าน / พนักงานหาบ้านสัตว์) ถูก seed ใน `dbo.users`  
พนักงานหาบ้านใช้ `adoption@petcare.local` / `Adoption1234` (ตั้ง `ADOPTION_STAFF_EMAIL` / `ADOPTION_STAFF_PASSWORD` ได้ถ้าต้องการ override)

สมาชิกสมัครและเข้าสู่ระบบผ่าน `/api/auth/register` และ `/api/auth/login` ตามลำดับ การเพิ่มหรือแก้ไขโพสต์สัตว์ต้องส่ง bearer token ของสมาชิกที่เข้าสู่ระบบ โดย Backend จะอนุญาตให้แก้ไขเฉพาะโพสต์ของบัญชีนั้น

บัญชีสมาชิก, session, โพสต์สัตว์ และคำร้องยังเก็บในหน่วยความจำสำหรับการทดลองใช้งาน จึงถูกล้างเมื่อ Backend เริ่มใหม่ บัญชีสมาชิกที่เคยสมัครไว้เฉพาะใน browser ก่อนเชื่อมระบบนี้ต้องสมัครใหม่
