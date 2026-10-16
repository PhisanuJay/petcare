# PetCare Backend

API แยกตามบทบาท (คู่กับ `frontend/src/features/`)

```text
src/
  server.js
  routes/index.js      # รวม mount /api/<role>
  modules/
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

```bash
cd backend
npm install
npm run dev
```

ค่าเริ่มต้น: `http://localhost:3001` — health ที่ `/health`
