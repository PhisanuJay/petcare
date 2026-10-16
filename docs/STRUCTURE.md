# PetCare — โครงสร้างโปรเจค React

สถานะ: **โครงไฟล์เท่านั้น** — ยังไม่ต้อง `npm install` และยังไม่มี logic จริง

## ต้นไม้โฟลเดอร์

```text
petcare/
├── docs/
│   ├── PAGE-17-SITEMAP.md   # แผนผังหน้าตาม Page 17 + ตาราง route
│   ├── STRUCTURE.md         # ไฟล์นี้
│   └── OWNERSHIP.md         # ใครรับผิดชอบส่วนไหน
├── public/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── routes/
│   │   └── roleRoutes.jsx   # รวม route ทุก role (ลิงก์โครงเข้าด้วยกัน)
│   ├── shared/              # ของใช้ร่วม — อย่าใส่ logic เฉพาะ role
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   └── utils/
│   └── features/            # แยกตามบทบาทจาก Page 17
│       ├── pet-owner/           # มะแอ่ว
│       ├── veterinarian/        # มะแอ่ว
│       ├── medical-assistant/   # เอิร์ท
│       ├── pet-profile/         # เอิร์ท, ปร่ย (shared)
│       ├── pet-hotel/           # ฟ่าง, เจ
│       ├── pet-transport/       # โมเดล
│       ├── adoption/            # ปร่ย
│       ├── admin/               # เจ
│       └── super-admin/         # ฟ่าง
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## กติกาแยกงาน (สำคัญ)

1. **ทำงานในโฟลเดอร์ role ของตัวเองเท่านั้น** เช่น มะแอ่ว → `pet-owner/` และ `veterinarian/`
2. **อย่า copy หน้าข้าม role** แม้ชื่อคล้ายกัน (เช่น Appointments ของ Vet กับ Medical Assistant คนละไฟล์)
3. ของใช้ร่วมจริง ๆ ใส่ `src/shared/` หรือ `src/features/pet-profile/`
4. เพิ่มหน้าใหม่ → สร้างไฟล์ใน `features/<role>/pages/` แล้วผูก route ใน `src/routes/roleRoutes.jsx`
5. อัปเดต markdown ใน `docs/` เมื่อเพิ่ม/เปลี่ยนหน้า

## เมื่อพร้อมรันจริง (ภายหลัง)

```bash
npm install
npm run dev
```

ตอนนี้ยังไม่ต้องลงอะไร — มีแค่โครงไฟล์และลิงก์ route ไว้แล้ว
