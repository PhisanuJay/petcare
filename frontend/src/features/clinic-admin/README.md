# Clinic Admin Frontend (`clinic-admin`)

ผู้รับผิดชอบ: เอิร์ท

## หน้าที่ของโมดูล
หน้าจัดการสำหรับ **แอดมินโรงพยาบาล (`clinic_admin`)** เพื่อบริหารงานหลังบ้านของคลินิก PetCare ได้แก่ บัญชีเจ้าหน้าที่ ตารางเวรและวันลาของสัตวแพทย์ วันปิดทำการ เวลาเปิด-ปิดคลินิก บริการที่เปิดจองออนไลน์ และรายงานสถิติ

## เส้นทางและหน้าทั้ง 5 หน้า
ป้องกันสิทธิ์ด้วย `<RequireStaff role="clinic_admin" />` ผ่าน `ClinicAdminLayout`:

| Path | ไฟล์ | หน้าที่ |
|---|---|---|
| `/clinic-admin` | `pages/Overview.jsx` | ภาพรวมวันนี้ (สถิติ นัดตามสถานะ หมอเข้าเวร วันปิดคลินิกใน 3 วันข้างหน้า เมนูด่วน) |
| `/clinic-admin/staff` | `pages/Staff.jsx` | ค้นหา กรองตามตำแหน่ง เพิ่มบัญชี แก้ไข (พร้อมคำเตือนนัดค้างของหมอ) ตั้งรหัสผ่านใหม่ และเปิด/ปิดใช้งานบัญชี |
| `/clinic-admin/schedule` | `pages/Schedule.jsx` | ตั้งตารางเวรประจำสัปดาห์ของหมอ จ.–อา. เพิ่ม/ลบวันลา และเพิ่ม/ลบวันปิดคลินิก |
| `/clinic-admin/services` | `pages/Services.jsx` | แคตตาล็อกบริการ เพิ่ม/แก้ไข ตั้งราคาแยกสุนัข–แมว เปิด-ปิดจองออนไลน์ |
| `/clinic-admin/settings` | `pages/Settings.jsx` | ตั้งค่าเวลาทำการทุก 30 นาที และเปิด/ปิดบริการที่รับจองออนไลน์ |
| `/clinic-admin/reports` | `pages/Reports.jsx` | ดูรายงานสถิติตามช่วงวันที่ อัตราไม่มาตามนัด เวลาตอบคำขอ ภาระงานหมอ กิจกรรมผู้ช่วยฯ และพิมพ์รายงาน |

## การเข้าสู่ระบบ
- เข้าสู่ระบบที่หน้า `/login` ด้วยบัญชี role `clinic_admin` (บัญชีทดสอบ: `admin@petcare.clinic` / `vet12345`)
- หลังล็อกอินจะถูกส่งไปยัง `STAFF_HOME.clinic_admin` (`/clinic-admin`)
- `caRequest()` ส่ง `Authorization: Bearer <token>` และเมื่อได้ `401` จะล้าง session แล้วส่ง `STAFF_SESSION_EXPIRED` เพื่อให้ `AuthContext` พากลับหน้า `/login`

## API ที่เรียกใช้ (`/api/clinic-admin/*`)
- `GET /overview`
- `GET /staff`, `POST /staff`, `PATCH /staff/:id`, `POST /staff/:id/password`
- `GET /roster`, `PUT /roster/:staffId/weekdays`, `POST /roster/:staffId/leaves`, `DELETE /roster/:staffId/leaves/:leaveId`
- `GET /closures`, `POST /closures`, `DELETE /closures/:date`
- `GET /settings`, `PUT /settings/hours`, `PUT /settings/services`
- `GET /services`, `POST /services`, `PATCH /services/:code`
- `GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD`
