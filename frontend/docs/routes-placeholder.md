# Route inventory (ย่อ)

| เส้นทาง | สถานะ |
|---------|--------|
| `/pet-owner/cat-hotel/book`, stays API | ใช้งานจริง (MSSQL) |
| `/pet-owner/cat-hotel/reservations` | redirect → book |
| `/pet-owner/transport/requests` | redirect → history |
| `/pet-owner/adoption` (Hub) | `/api/adoption` + MSSQL |
| `/adoption/*` staff | Animals, requests, history |
| `/pet-hotel/*` | แจ้ง + ลิงก์ owner / super-admin |
| `ClinicBookPage` | ไม่มี route (localStorage เดิม) |