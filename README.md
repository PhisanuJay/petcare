# PetCare

โปรเจค React (Vite) สำหรับระบบ PetCare — **โครงแยกตามบทบาทจาก Page 17**

สถานะตอนนี้: สร้างไฟล์โครงไว้แล้ว **ยังไม่ต้องลง dependency / ยังไม่มี UI จริง**

## เอกสาร

| ไฟล์ | เนื้อหา |
|------|---------|
| [docs/PAGE-17-SITEMAP.md](docs/PAGE-17-SITEMAP.md) | แผนผังหน้าทุก role + ตารางไฟล์/route |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | โครงสร้างโฟลเดอร์และกติกาแยกงาน |
| [docs/OWNERSHIP.md](docs/OWNERSHIP.md) | ใครรับผิดชอบส่วนไหน |

## โครงตาม Role (Page 17)

```text
src/features/
  pet-owner/           ← มะแอ่ว
  veterinarian/        ← มะแอ่ว
  medical-assistant/   ← เอิร์ท
  pet-profile/         ← เอิร์ท, ปร่ย
  pet-hotel/           ← ฟ่าง, เจ
  pet-transport/       ← โมเดล
  adoption/            ← ปร่ย
  admin/               ← เจ
  super-admin/         ← ฟ่าง
```

Route รวมอยู่ที่ `src/routes/roleRoutes.jsx`

## เมื่อพร้อมเริ่มพัฒนา

```bash
git clone <repository-url>
cd petcare
npm install
npm run dev
```

## แผนต่อไป

- ลง package แล้วรัน Vite
- ใส่ UI / logic ในโฟลเดอร์ role ของแต่ละคน
- เชื่อม API ตามฟีเจอร์จริง
