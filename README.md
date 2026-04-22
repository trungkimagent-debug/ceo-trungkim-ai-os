# CEO Trung Kim AI Operating System
Hệ điều hành AI toàn diện cho **Di Động Trung Hậu Kim Dung** - quản lý vận hành cửa hàng di động bằng AI Agent tự động.

## Tính năng chính

### Quản lý Nhân sự & Ca làm
- Quản lý nhân viên, phân ca tự động
- Chấm công GPS + WiFi
- Tính lương tự động

### Quản lý Kho
- Nhập/Xuất kho IMEI (điện thoại, máy tính bảng)
- Nhập/Xuất kho Non-IMEI (phụ kiện, linh kiện)
- Quét IMEI bằng camera (@zxing/browser)
- Kiểm kho, trả hàng NCC

### Quản lý Công nợ
- Công nợ Nhà cung cấp
- Công nợ Công ty tài chính (trả góp)
- Công nợ Khách hàng + Nhắc nợ tự động

### AI Agent System
- Multi-Agent Orchestrator
- 5 Cron Jobs tự động
- Rule Engine
- Trust Governance
- Closed-Loop Learning

### Giao diện
- Dark Luxury Theme (gold accent, glassmorphism)
- Chairman Command Center Dashboard
- Page transitions (framer-motion)
- IMEI Scanner camera

## Phân quyền
| Role | Quyền |
|------|-------|
| Chairman | Quyền cao nhất (Trung Hậu) |
| CEO/Admin | Quản lý toàn bộ nghiệp vụ |
| Manager | Quản lý ca, nhân viên, kho |
| Staff | Chấm công, xem ca, báo lỗi |

## Tech Stack
- Frontend: React 19 + Tailwind CSS 4 + shadcn/ui + framer-motion
- Backend: Firebase Cloud Functions (Express.js)
- Database: Cloud Firestore
- Auth: Firebase Authentication (Google Sign-In)
- Hosting: Firebase Hosting
- AI: OpenAI GPT integration

## Deploy
\`\`\`bash
cd functions && npm install
npm run build
firebase deploy
\`\`\`

## Live URL
https://trungkim-os.web.app

## Chairman Account
- Email: trunghaukimdunggroup@gmail.com
- Role: Chairman (quyền cao nhất)

---
2026 Di Động Trung Hậu Kim Dung. All rights reserved.
