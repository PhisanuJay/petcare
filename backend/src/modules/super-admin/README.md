# Super Admin (API)

**ผู้รับผิดชอบ:** ฟ่าง (Xsup404)

โฟลเดอร์ backend ของบทบาทนี้ — คู่กับ `frontend/src/features/super-admin/`

## Pet Hotel CCTV

หน้า CCTV อยู่ที่ `frontend/src/features/super-admin/hotel-cctv/`

ระบบ login ใช้ `/api/cctv-auth` ใน PetCare backend และบัญชีใน `data/cathotel.sqlite`
โดย proxy จาก Vite ผ่านพอร์ต 3001

API จัดการกล้อง ห้อง ลูกค้า และสิทธิ์ดูกล้อง (`/api/cctv-admin/rooms`,
`/api/cctv-admin/cameras`, `/api/cctv-admin/customers`, `/api/cctv-admin/grants`)
อยู่ใน PetCare backend และใช้ข้อมูลจาก `data/cathotel.sqlite` โดยเข้ารหัส RTSP URL
ด้วย `CAMERA_SECRET` จากไฟล์ `.env` ของโมดูลนี้

สิทธิ์ดูกล้องในหน้าลูกค้า PetCare ผูกกับ `owner_id` และอีเมลของบัญชี PetCare
ผ่าน `/api/pet-owner/cctv/cameras` ไม่ได้อ้าง `users.id` ของบัญชี CCTV

ฟีเจอร์ CCTV อื่นที่ยังไม่มี route ใน PetCare backend เช่นบันทึกการดูแลและภาพสด
ยังคาดหวัง service แยกที่เดิมระบุไว้เป็น `D:\CCTV\backend` พอร์ต 3000
