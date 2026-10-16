# PetCare — ตารางผู้รับผิดชอบ (จาก Page 17)

ใช้ไฟล์นี้เช็กว่าใครทำส่วนไหน เพื่อไม่ให้งานซ้อนกัน

| Role / Module | ผู้รับผิดชอบ | โฟลเดอร์ |
|---------------|--------------|----------|
| Pet Owner | มะแอ่ว | `src/features/pet-owner/` |
| Veterinarian | มะแอ่ว | `src/features/veterinarian/` |
| Medical Assistant | เอิร์ท | `src/features/medical-assistant/` |
| Pet Profile (shared) | เอิร์ท, ปร่ย | `src/features/pet-profile/` |
| Pet Hotel | ฟ่าง, เจ | `src/features/pet-hotel/` |
| Pet Transport | โมเดล | `src/features/pet-transport/` |
| Adoption | ปร่ย | `src/features/adoption/` |
| Admin | เจ | `src/features/admin/` |
| Super Admin | ฟ่าง | `src/features/super-admin/` |

## สรุปตามคน

| คน | ส่วนที่รับ |
|----|------------|
| **มะแอ่ว** | Pet Owner, Veterinarian |
| **เอิร์ท** | Medical Assistant, Pet Profile (ร่วมกับปร่ย) |
| **ปร่ย** | Adoption, Pet Profile (ร่วมกับเอิร์ท) |
| **ฟ่าง** | Pet Hotel (ร่วมกับเจ), Super Admin |
| **เจ** | Pet Hotel (ร่วมกับฟ่าง), Admin |
| **โมเดล** | Pet Transport |

## ของใช้ร่วม

| ส่วน | โฟลเดอร์ | หมายเหตุ |
|------|----------|----------|
| Layout / Home | `src/shared/` | โครงเปล่า ใช้ร่วมทั้งแอป |
| Routes รวม | `src/routes/roleRoutes.jsx` | อย่าย้ายหน้า role ไปโฟลเดอร์อื่น |
| Docs | `docs/` | อัปเดตเมื่อเปลี่ยนหน้าหรือเจ้าของ |

แผนผังหน้าละเอียด: [PAGE-17-SITEMAP.md](./PAGE-17-SITEMAP.md)
