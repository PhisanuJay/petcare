# Pet Transport (API)

**ผู้รับผิดชอบ:** โมเดล

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
