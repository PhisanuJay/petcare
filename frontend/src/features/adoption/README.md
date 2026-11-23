# Adoption

**ผู้รับผิดชอบ:** ปร่ย

**Flow (Page 17):**
`Dashboard → Animals → Add Animal → Adoption Requests → Request Detail`

ไฟล์หน้าอยู่ใน `pages/` — ผูก route ที่ `src/routes/roleRoutes.jsx`


Backend คู่กัน: `backend/src/modules/adoption/`

หน้าหาบ้านสำหรับผู้ใช้ทั่วไปอยู่ที่ `/find-home` และใช้ API:

- `GET /api/adoption/animals` — รายชื่อน้องที่ยังเปิดรับบ้าน
- `POST /api/adoption/animals` — เพิ่มสัตว์หาบ้านพร้อมรูปและข้อมูลสุขภาพ (ต้องเข้าสู่ระบบสมาชิก)
- `PATCH /api/adoption/animals/:id` — แก้ไขโพสต์ได้เฉพาะเจ้าของโพสต์
- `POST /api/adoption/applications` — ส่งคำขอรับเลี้ยง

เมื่อเรียก `GET /api/adoption/animals` พร้อม bearer token ระบบจะแจ้ง `isOwner` สำหรับโพสต์ที่เป็นของสมาชิกคนนั้น เพื่อแสดงปุ่มแก้ไขให้เจ้าของเท่านั้น โดย Backend ตรวจเจ้าของซ้ำทุกครั้งก่อนบันทึกการแก้ไข บัญชีสมาชิกเดิมที่เก็บไว้เฉพาะใน browser ต้องสมัครใหม่เพื่อใช้ระบบยืนยันตัวตนของ Backend

พนักงานใช้ `/adoption/login` เพื่อเข้าสู่ระบบด้วยบัญชีที่ตั้งผ่าน environment ของ Backend จากนั้นตรวจคำร้องได้ที่ `/adoption/requests` และเปลี่ยนสถานะสัตว์ได้ที่ `/adoption/animals` API สำหรับพนักงานต้องใช้ token ที่ได้จากการเข้าสู่ระบบ

ฟอร์มขอรับเลี้ยงเก็บชื่อ-นามสกุล อายุ อาชีพ เบอร์โทร เงินเดือน รูป Statement เงินเดือน ประเภทที่พัก รูปสภาพบ้าน และจำนวนแมวที่มีอยู่แล้ว (ถ้ามี) รูปสัตว์ รูปสภาพบ้าน และรูป Statement รองรับ JPEG, PNG และ WebP ขนาดไม่เกิน 3 MB ต่อรูป บัญชีสมาชิก, session, ข้อมูลสัตว์ และคำขอใน backend ปัจจุบันเก็บในหน่วยความจำสำหรับการทดลองใช้งาน และจะหายเมื่อปิดหรือเริ่ม server ใหม่
