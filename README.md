# PetCare

แยก **frontend** / **backend** ตามบทบาทจาก Page 17

```text
petcare/
├── frontend/     # React (Vite)
│   └── src/features/<role>/
└── backend/      # Express API
    └── src/modules/<role>/
```

## Role folders

| Role | ผู้รับผิดชอบ | Frontend | Backend |
|------|--------------|----------|---------|
| Pet Owner | มะแอ่ว | `frontend/src/features/pet-owner/` | `backend/src/modules/pet-owner/` |
| Veterinarian | มะแอ่ว | `frontend/src/features/veterinarian/` | `backend/src/modules/veterinarian/` |
| Medical Assistant | เอิร์ท | `frontend/src/features/medical-assistant/` | `backend/src/modules/medical-assistant/` |
| Pet Profile | เอิร์ท, ปร่ย | `frontend/src/features/pet-profile/` | `backend/src/modules/pet-profile/` |
| Pet Hotel | ฟ่าง, เจ | `frontend/src/features/pet-hotel/` | `backend/src/modules/pet-hotel/` |
| Pet Transport | โมเดล | `frontend/src/features/pet-transport/` | `backend/src/modules/pet-transport/` |
| Adoption | ปร่ย | `frontend/src/features/adoption/` | `backend/src/modules/adoption/` |
| Admin | เจ | `frontend/src/features/admin/` | `backend/src/modules/admin/` |
| Super Admin | ฟ่าง | `frontend/src/features/super-admin/` | `backend/src/modules/super-admin/` |

## รัน

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (อีกเทอร์มินัล)
cd backend
npm install
npm run dev
```

- Frontend: Vite (ดูพอร์ตในเทอร์มินัล)
- Backend: `http://localhost:3001` — health ที่ `/health`
