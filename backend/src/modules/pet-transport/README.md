# Pet Transport API (SQLite)

เก็บข้อมูลจอง / ทริป / แจ้งเตือนในไฟล์ SQLite จริง ที่ `backend/data/petcare-transport.sqlite`

<<<<<<< HEAD
REST API บน SQLite (`backend/data/petcare-transport.sqlite`) คู่กับ `frontend/src/features/pet-transport/`

## เริ่มต้น

รัน backend หลักที่พอร์ต `3001` — โมดูลนี้เปิด DB และ migrate อัตโนมัติตอนโหลด routes

```bash
npm run dev
```

## Endpoints หลัก

- `GET /api/pet-transport/state` — snapshot ทั้งระบบ
- `POST /api/pet-transport/bookings` — สร้างการจอง
- workflow อื่น: confirm-price, assign-driver, payment, trip status, cancel, hotels, zones
=======
ใช้ built-in `node:sqlite` (Node 22+) — ไม่ต้องติดตั้ง DB server

## รัน

```bash
cd backend
npm run dev
```

Health: `GET http://localhost:3001/health`

## Endpoints หลัก (`/api/pet-transport`)

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/catalog` | zones, clinics, hotels |
| GET | `/snapshot` | ทั้งระบบ (bookings + trips) |
| GET | `/bookings` | รายการจอง |
| POST | `/bookings` | สร้างจอง + ทริป |
| GET | `/bookings/:id` | รายละเอียดจอง |
| POST | `/bookings/:id/confirm-price` | Admin ยืนยันราคา |
| POST | `/bookings/:id/mark-paid` | Admin ยืนยันชำระ |
| POST | `/bookings/:id/owner-confirm-payment` | Owner แจ้งชำระ |
| GET | `/trips?driverId=` | ทริป (กรองคนขับได้) |
| POST | `/trips/:id/assign-driver` | มอบหมายคนขับ |
| POST | `/trips/:id/advance` | อัปเดตสถานะทริป |
| PATCH | `/trips/:id/schedule` | เปลี่ยนเวลานัด |
| POST | `/trips/:id/evidence` | แนบรูป |
| POST | `/trips/:id/issues` | แจ้งปัญหา |
| GET | `/drivers/:id/notifications` | แจ้งเตือนคนขับ |

Response รูปแบบ: `{ ok: true, data }` หรือ `{ ok: false, error }`
>>>>>>> origin/Admin-transport
