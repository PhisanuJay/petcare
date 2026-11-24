# Medical Assistant (API)

**ผู้รับผิดชอบ:** เอิร์ท  
โฟลเดอร์ backend ของบทบาทนี้ — คู่กับ `frontend/src/features/medical-assistant/`

> **หมายเหตุ:** เชื่อมต่อกับระบบการจองกลาง (`pet-owner/bookingStore.js`) เต็มรูปแบบ — **ยังไม่รองรับ walk-in หรือจองทางโทรศัพท์** (ไม่มี endpoint สร้างนัดใหม่โดยตรง นัดทั้งหมดมาจากการจองของเจ้าของสัตว์เลี้ยง)

---

## การแบ่งหน้าที่ในระบบการจองกลาง

| บทบาท | สิทธิ์ / หน้าที่หลัก | สถานะที่ดำเนินการได้ |
| :--- | :--- | :--- |
| **เจ้าของสัตว์เลี้ยง (Pet Owner)** | สร้างคำขอจองออนไลน์และยกเลิกนัดของตนเอง | สร้าง `pending` / ยกเลิก `pending` หรือ `confirmed` → `cancelled` |
| **ผู้ช่วยสัตวแพทย์ (Medical Assistant)** | คัดกรองคำขอ, มอบหมายหมอ/ระยะเวลา, เลื่อนนัด, เช็คอิน, วัดสัญญาณชีพ/คัดกรอง, บันทึกข้อควรระวัง/โน้ตผู้ป่วย | `pending` → `confirmed` \| `rejected`, `confirmed` → `no_show`, เลื่อน `pending`/`confirmed`, และบันทึกข้อมูลภายใน (`checked_in`, `in_treatment`, `vitals`, `flags`, `notes`) |
| **สัตวแพทย์ (Veterinarian)** | ดูเฉพาะนัดที่ MA ยืนยันแล้ว (`VET_VISIBLE_STATUSES`), บันทึกผลตรวจ/วัคซีน/พยาธิ และปิดเคส | `confirmed` → `completed` |

---

## การเข้าสู่ระบบ

- ยกเว้น `GET /api/medical-assistant/` ทุก endpoint ต้องส่ง `Authorization: Bearer <token>` ที่ได้จาก `POST /api/auth/staff/login`
  - `401 Unauthorized` เมื่อไม่ได้ส่ง token หรือ session หมดอายุ / รีสตาร์ท backend
  - `403 Forbidden` เมื่อบัญชีที่ล็อกอินไม่ใช่ role `medical_assistant`
- บัญชี dev สำหรับผู้ช่วยสัตวแพทย์ (รหัสผ่านเดียวกับบัญชี dev อื่นใน `auth/staffAccounts.js`):
  - `ma1@petcare.clinic` — สมใจ ช่วยดี
  - `ma2@petcare.clinic` — กมล ใส่ใจ
- ไม่ส่ง `ownerId` ออกไปใน response ใดๆ และ list endpoints รวมถึง `GET /appointments/:id` จะไม่ส่ง `photo`

---

## รายการ Endpoints (`/api/medical-assistant`)

| Method & Path | Body / Query | Response | Errors |
| :--- | :--- | :--- | :--- |
| `GET /` | — | `{ module, owner, status: 'ok' }` | — |
| `GET /appointments` | `?date=&from=&to=&status=&stage=` | Array ของ `appointmentView` (`pet`, `visit`, `stage`, `visibleToVet`, ไม่มี `ownerId`/`photo`) | `400` วันที่/สถานะ/stage ไม่ถูกต้อง, `401`, `403` |
| `GET /appointments/:id` | — | `appointmentView` + `vetRecords`, `vaccinesGiven`, `parasitesGiven` (`source: 'vet'` วันเดียวกับวันนัด, ไม่มี `ownerId`/`photo`) | `404` ไม่พบนัดหมายนี้, `401`, `403` |
| `POST /appointments/:id/status` | `{ status: 'confirmed' \| 'rejected' \| 'no_show', vet?, durationMin?, reason?, note? }` | `appointmentView` ที่อัปเดตแล้ว (บันทึก `handledBy` จาก `req.staff.name` เมื่อยืนยัน/ปฏิเสธ) | `400` ข้อมูลไม่ครบ/ผิดค่า, `403` ส่ง `completed`/`cancelled`/`pending`, `404` ไม่พบนัด, `409` สถานะเดิมไม่รองรับ / หมอเวลาชน / เช็คอินแล้ว / `no_show` ยังไม่ถึงวันนัด |
| `POST /appointments/:id/reschedule` | `{ date, time }` | `appointmentView` วันเวลาใหม่ (บันทึก `rescheduledFrom` ใน visit) | `400` นอกเวลาทำการ/อดีต, `404`, `409` ดำเนินการไปแล้ว / เช็คอินแล้ว / สัตว์หรือหมอเวลาชน |
| `POST /appointments/:id/check-in` | — | `appointmentView` (`stage: 'checked_in'`, บันทึก `checkedInAt` และ `checkedInBy`) | `404`, `409` ไม่ใช่ `confirmed` / ไม่ใช่วันนี้ / เช็คอินแล้ว |
| `POST /appointments/:id/start-treatment` | — | `appointmentView` (`stage: 'in_treatment'`) | `404`, `409` ยังไม่เช็คอิน / เริ่มตรวจแล้ว / ไม่ใช่ `confirmed` |
| `POST /appointments/:id/contacted` | — | `appointmentView` (บันทึก `contactedAt` และ `contactedBy` ใน visit) | `404`, `409` ไม่ใช่ `no_show` |
| `PUT /visits/:bookingId` | `{ triage?, chiefComplaint?, vitals?, checklist? }` | ข้อมูล `visit` ที่บันทึกใน `visits.json` | `400` ค่า vitals/triage/checklist ผิดรูปแบบหรือช่วง, `404`, `409` ยังไม่เช็คอิน หรือปิดเคสแล้ว |
| `GET /visits` | `?date=YYYY-MM-DD` (default วันนี้) | Array ของ visits วันนั้นพร้อม `petName`, `petSpecies`, `time`, `serviceLabel`, `status`, `stage` | `400` วันที่ไม่ถูกต้อง, `401`, `403` |
| `GET /patients` | — | รายชื่อสัตว์ลงทะเบียน (ไม่มี `photo`/`ownerId`) + `visitCount`, `lastVisit`, `nextAppointment`, `flags`, `ownerName`, `ownerPhone` เรียง ก–ฮ | `401`, `403` |
| `GET /patients/:id` | — | ข้อมูลสัตว์เต็ม (ไม่มี `ownerId`) + `appointments`, `flags`, `notes`, `latestVitals` | `404` ไม่พบข้อมูลสัตว์เลี้ยง, `401`, `403` |
| `PUT /patients/:id/flags` | `{ flags: string[] }` | `{ petId, flags, notes }` | `400` flag ผิดหรือซ้ำ, `404` ไม่พบข้อมูลสัตว์เลี้ยง |
| `POST /patients/:id/notes` | `{ category, text }` | Note ที่สร้างใหม่ (`201`) | `400` หมวดผิด/ข้อความว่างหรือ > 1000 ตัวอักษร, `404` ไม่พบข้อมูลสัตว์เลี้ยง |
| `DELETE /patients/:id/notes/:noteId` | — | `{ ok: true }` | `404` ไม่พบข้อมูลสัตว์เลี้ยงหรือโน้ต |
| `GET /vaccination/due` | `?days=30` (`0–365`) | รายการวัคซีนครบกำหนด/เลยกำหนดจาก `veterinarian/dueVaccines.js` | `400` จำนวนวันไม่ถูกต้อง, `401`, `403` |
| `GET /follow-ups` | `?days=7` (`0–365`) | รายการนัดติดตามจากบันทึกหมอ (`source: 'vet'`) ที่ใกล้ถึง/เลยกำหนด และยังไม่มีนัดหลังวันตรวจนั้น | `400` จำนวนวันไม่ถูกต้อง, `401`, `403` |
| `GET /meta` | — | ค่าคงที่คลินิกและ MA (`BOOKING_SERVICES`, เวลาทำการ, `VET_NAMES` จากรายชื่อหมอใน `staffAccounts`, `DURATIONS`, `CAUTION_FLAGS`, `NOTE_CATEGORIES`, `TRIAGE_LEVELS`, `REJECT_REASONS`, `VITAL_LIMITS`) | `401`, `403` |
