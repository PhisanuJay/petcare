<<<<<<< Updated upstream
# Pet Transport (API)

**ผู้รับผิดชอบ:** โมเดล

โฟลเดอร์ backend ของบทบาทนี้ — คู่กับ `frontend/src/features/pet-transport/`
=======
# Pet Transport API (Microsoft SQL Server)

ข้อมูลจอง / ทริป / แจ้งเตือน / payments อยู่ใน SQL Server database `PetCare`  
(โมดูล CCTV ยังใช้ SQLite ของตัวเองแยกต่างหาก)

## ตั้งค่า

คัดลอก `backend/.env.example` เป็น `backend/.env` แล้วใส่ค่าเชื่อมต่อ SQL Server

```bash
cd backend
npm run db:ping
npm run dev
```

ตารางถูกสร้างอัตโนมัติตอนสตาร์ท (`migrate.js`)

## Endpoints หลัก

- `GET /api/pet-transport/state` — snapshot ทั้งระบบ
- `POST /api/pet-transport/bookings` — สร้างการจอง
- workflow อื่น: confirm-price, assign-driver, payment, trip status, cancel, zones
- `GET /api/payments/*` — โมดูลชำระเงิน / ยกเลิก (MSSQL เดียวกัน)

Health: `GET http://localhost:3001/health` → `engine: "mssql"`
>>>>>>> Stashed changes
