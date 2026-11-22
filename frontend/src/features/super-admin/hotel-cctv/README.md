# Pet Hotel CCTV (Super Admin / ฟ่าง · Xsup404)

แอปจัดการกล้องโรงแรมสัตว์เลี้ยง — รันแยกจาก monorepo หลักได้

## รัน

```bash
# Backend (อีกโฟลเดอร์)
cd ../../../backend/src/modules/super-admin/hotel-cctv
cp .env.example .env
npm install
npm run dev

# Frontend
cd frontend/src/features/super-admin/hotel-cctv
npm install
npm run dev
```

ค่าเริ่มต้นแอดมิน: ดูใน `.env.example`

**อย่า commit** `.env`, `data/`, หรือไฟล์ key/cert
