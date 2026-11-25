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
<<<<<<< Updated upstream
=======

บัญชีทุกบทบาท (รวมหาบ้าน / พนักงานหาบ้านสัตว์) ถูก seed ใน `dbo.users`  
พนักงานหาบ้านใช้ `adoption@petcare.local` / `Adoption1234` (ตั้ง `ADOPTION_STAFF_EMAIL` / `ADOPTION_STAFF_PASSWORD` ได้ถ้าต้องการ override)

สมาชิกสมัครและเข้าสู่ระบบผ่าน `/api/auth/register` และ `/api/auth/login` ตามลำดับ การเพิ่มหรือแก้ไขโพสต์สัตว์ต้องส่ง bearer token ของสมาชิกที่เข้าสู่ระบบ โดย Backend จะอนุญาตให้แก้ไขเฉพาะโพสต์ของบัญชีนั้น

บัญชีสมาชิก, session, โพสต์สัตว์ และคำร้องยังเก็บในหน่วยความจำสำหรับการทดลองใช้งาน จึงถูกล้างเมื่อ Backend เริ่มใหม่ บัญชีสมาชิกที่เคยสมัครไว้เฉพาะใน browser ก่อนเชื่อมระบบนี้ต้องสมัครใหม่
>>>>>>> Stashed changes
