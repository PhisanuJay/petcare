# Clinic Admin (API)

**ผู้รับผิดชอบ:** เอิร์ท  
โฟลเดอร์ backend ของบทบาทแอดมินโรงพยาบาล (`clinic_admin`) — จัดการบัญชีเจ้าหน้าที่ ตารางเวรสัตวแพทย์ เวลาทำการ บริการที่เปิดจองออนไลน์ วันปิดคลินิก ภาพรวม และรายงาน

---

## การเข้าสู่ระบบ

- ยกเว้น `GET /api/clinic-admin/public/clinic-info` ทุก endpoint ต้องส่ง `Authorization: Bearer <token>` ที่ได้จาก `POST /api/auth/staff/login` และต้องเป็นบัญชี role `'clinic_admin'`
- บัญชี dev เริ่มต้น: `admin@petcare.clinic` (รหัสผ่านเดียวกับบัญชี dev อื่นใน `auth/staffAccounts.js`)
- ไม่มี response ใดส่ง `passwordHash`, `salt`, หรือ `ownerId` ออกไป

---

## ไฟล์ข้อมูลและการตั้งค่า

- `backend/src/modules/auth/data/staff.json` — รายชื่อบัญชีเจ้าหน้าที่ (seed 7 บัญชีเมื่อไม่มีไฟล์; จัดการผ่าน `auth/staffAccounts.js`)
- `backend/src/modules/clinic-admin/data/clinic-settings.json` — เวลาทำการ 7 วัน (`0`..`6`, `null` = ปิดทั้งวัน), สถานะ `online` ของบริการ, และวันปิดคลินิก `closures`
- `backend/src/modules/clinic-admin/data/roster.json` — ตารางเวรรายสัปดาห์ `weekdays` และวันลา `leaves` ของสัตวแพทย์
  - **กฎตารางเวร:** สัตวแพทย์ที่ยังไม่มี record ใน `roster.json` ถือว่า **เข้าเวรทุกวัน** (เพื่อความเข้ากันได้เมื่อยังไม่ได้ตั้งเวร)

---

## รายการ Endpoints (`/api/clinic-admin`)

| Method & Path | หน้าที่ | สิทธิ์ |
| :--- | :--- | :--- |
| `GET /public/clinic-info` | เวลาทำการ 7 วัน, บริการที่เปิดจองออนไลน์ (`code`, `label`), วันปิดคลินิก 90 วันข้างหน้า, `slotMinutes` | สาธารณะ |
| `GET /staff` | รายชื่อเจ้าหน้าที่ทั้งหมด (`listAllStaff`) + `pendingAssignments` สำหรับสัตวแพทย์ | `clinic_admin` |
| `POST /staff` | สร้างบัญชีเจ้าหน้าที่ใหม่ (`201`) | `clinic_admin` |
| `PATCH /staff/:id` | แก้ไขชื่อ, อีเมล, บทบาท, หรือ `active` (ห้ามปิดตัวเอง `409` และห้ามปิดแอดมิน active คนสุดท้าย `409`) | `clinic_admin` |
| `POST /staff/:id/password` | ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร, สุ่ม salt ใหม่) | `clinic_admin` |
| `GET /settings` | ดูตั้งค่าเวลาทำการ วันปิดคลินิก และบริการทั้งหมด (`listServices`) | `clinic_admin` |
| `PUT /settings/hours` | ปรับเวลาทำการรายวัน (`0`..`6`, `:00`/`:30` และ `open < close` ≥ 30 นาที หรือ `null`) | `clinic_admin` |
| `PUT /settings/services` | เปิด/ปิดการจองออนไลน์รายบริการ | `clinic_admin` |
| `GET /services` | รายการแคตตาล็อกบริการพร้อมราคา (รวมที่ปิดใช้งาน) | `clinic_admin` |
| `POST /services` | เพิ่มบริการใหม่ (รหัส, ชื่อ, ราคา dog/cat, ออนไลน์) | `clinic_admin` |
| `PATCH /services/:code` | แก้ไขบริการ/ราคา/สถานะ | `clinic_admin` |
| `GET /closures` | วันปิดคลินิกในอนาคต พร้อม `affectedBookings` | `clinic_admin` |
| `POST /closures` | เพิ่มวันปิดคลินิก (`201`) พร้อม `affectedBookings` | `clinic_admin` |
| `DELETE /closures/:date` | ลบวันปิดคลินิก | `clinic_admin` |
| `GET /roster` | ตารางเวรและวันลาของหมอ active ทุกคน พร้อม `onDutyToday` | `clinic_admin` |
| `PUT /roster/:staffId/weekdays` | ตั้งวันเข้าเวรประจำสัปดาห์ `[0..6]` ของสัตวแพทย์ | `clinic_admin` |
| `POST /roster/:staffId/leaves` | เพิ่มช่วงวันลาของสัตวแพทย์ (`201`) พร้อม `affectedBookings` | `clinic_admin` |
| `DELETE /roster/:staffId/leaves/:leaveId` | ลบช่วงวันลาของสัตวแพทย์ | `clinic_admin` |
| `GET /overview` | ภาพรวมวันนี้ (นัดตามสถานะ, `pendingTotal`, `pendingOver24h`, `vetsOnDutyToday`, `upcomingClosures` 3 วัน) | `clinic_admin` |
| `GET /reports?from&to` | รายงานสรุปช่วง `from..to` (ค่าเริ่มต้น 30 วันย้อนหลัง สูงสุด 366 วัน) | `clinic_admin` |
