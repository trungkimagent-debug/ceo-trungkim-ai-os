# CEO Trung Kim AI Operating System

Hệ điều hành AI toàn diện cho **Di Động Trung Hậu Kim Dung** — quản lý vận hành cửa hàng di động bằng AI Agent tự động.

## Trạng thái nâng cấp

- ✅ Firebase Cloud Functions API cho nghiệp vụ vận hành.
- ✅ Firebase Hosting có landing page responsive/dark luxury tại `public/`.
- ✅ API health check: `/api/health`.
- ✅ Firestore rules đã siết quyền theo role, chống user tự nâng quyền.
- ✅ CORS có thể cấu hình qua `ALLOWED_ORIGINS`.
- ✅ Security headers cơ bản cho API.

## Tính năng chính

### Quản lý Nhân sự & Ca làm
- Quản lý nhân viên, phân ca tự động.
- Chấm công GPS/WiFi-ready.
- Tính lương/KPI-ready.

### Quản lý Kho
- Nhập/Xuất kho IMEI: điện thoại, máy tính bảng.
- Nhập/Xuất kho Non-IMEI: phụ kiện, linh kiện.
- Kiểm kho, trả hàng nhà cung cấp.

### Quản lý Công nợ
- Công nợ nhà cung cấp.
- Công nợ công ty tài chính/trả góp.
- Công nợ khách hàng và nhắc nợ tự động.

### AI Agent System
- Multi-Agent Orchestrator.
- Cron jobs tự động.
- Rule Engine / Trust Governance.
- Closed-loop learning qua audit và đề xuất cải tiến.

### Giao diện
- Dark Luxury Theme, gold accent, glassmorphism.
- Chairman Command Center landing page.
- Responsive mọi loại màn hình.

## Phân quyền

| Role | Quyền |
|------|-------|
| Chairman | Quyền cao nhất của Chủ tịch Trung Hậu |
| CEO/Admin | Quản lý toàn bộ nghiệp vụ |
| Manager | Quản lý ca, nhân viên, kho |
| Staff | Chấm công, xem ca, báo lỗi |

## Tech Stack

- Backend: Firebase Cloud Functions v2 + Express.js.
- Database: Cloud Firestore.
- Auth: Firebase Authentication.
- Hosting: Firebase Hosting.
- AI: OpenAI GPT integration.
- Frontend hiện tại: static responsive landing page trong `public/`.

## Chạy kiểm tra local

```bash
cd functions
npm install --include=dev
npm run build
```

## Deploy

```bash
cd functions && npm install --include=dev && npm run build
cd ..
firebase deploy
```

## Cấu hình production nên có

Dùng biến môi trường/secrets cho Functions, không commit file key vào repo:

```bash
OPENAI_API_KEY=...
ALLOWED_ORIGINS=https://trungkim-os.web.app
```

`ALLOWED_ORIGINS` có thể chứa nhiều domain, phân tách bằng dấu phẩy.

## Live URL

https://trungkim-os.web.app

## Chairman Account

- Email: `trunghaukimdunggroup@gmail.com`
- Role: `chairman`

---

© 2026 Di Động Trung Hậu Kim Dung. All rights reserved.
