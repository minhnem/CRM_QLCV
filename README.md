# Hệ Thống CRM & Quản Lý Công Việc (MERN Stack Base)
> Nền tảng quản lý dự án, công việc và khách hàng chuẩn Bitrix24 xây dựng trên nền tảng **MERN Stack** (MongoDB, Express, React, Node.js) và **Socket.IO** Real-time.

---

## 🚀 Công Nghệ Sử Dụng (Tech Stack)

| Thành phần | Công nghệ | Chi tiết |
|------------|-----------|----------|
| **Database** | MongoDB + Mongoose 8.x | Lưu trữ Users, Projects, Tasks, Activity Logs |
| **Backend** | Node.js + Express 5.x | RESTful API, Helmet, CORS, Morgan |
| **Authentication** | JWT (JSON Web Tokens) + Bcrypt | Phân quyền RBAC (Admin, Manager, Member) |
| **Real-time** | Socket.IO | Đồng bộ Kanban Board và thông báo tức thì |
| **Frontend** | React 19 + Vite 6 | SPA hiện đại, tối ưu tốc độ tải trang |
| **UI Design** | Vanilla CSS Design System | Giao diện chuẩn Bitrix24/Linear, responsive |
| **Icons** | Lucide React | Bộ icon hiện đại, tối giản |

---

## 📁 Cấu Trúc Thư Mục (Folder Structure)

```
CRM_QLCV/
├── package.json              # Chạy đồng thời client & server với concurrently
├── .gitignore
├── README.md
│
├── server/                   # Backend Node.js & Express
│   ├── .env                  # Biến môi trường backend
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config/           # Kết nối MongoDB (db.js), JWT, Socket.IO
│       ├── models/           # Mongoose Models: User, Project, Task, ActivityLog
│       ├── controllers/      # auth, project, task, user, dashboard controllers
│       ├── routes/           # RESTful API routing (/api/...)
│       ├── middlewares/      # authMiddleware (protect & role authorize), errorHandler
│       ├── utils/            # seedData.js (Dữ liệu mẫu ban đầu)
│       └── server.js         # Entry point backend
│
└── client/                   # Frontend React & Vite
    ├── package.json
    ├── vite.config.js        # Cấu hình proxy /api và WebSocket sang port 5000
    ├── index.html            # Google Fonts (Plus Jakarta Sans)
    └── src/
        ├── context/          # AuthContext (quản lý login/logout/user state)
        ├── services/         # api.js (Axios + Interceptors), socket.js (Socket.IO client)
        ├── components/
        │   ├── auth/         # ProtectedRoute guard
        │   ├── layout/       # Sidebar, Navbar, MainLayout
        │   └── tasks/        # CreateTaskModal
        ├── pages/            # Login, Register, Dashboard, KanbanBoard, Projects, Team, Settings
        ├── index.css         # Hệ thống Design Tokens & CSS hiện đại
        ├── App.jsx           # Cấu hình React Router
        └── main.jsx
```

---

## ⚡ Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Khởi chạy toàn bộ (Client & Server)
Từ thư mục gốc `e:\CRM_QLCV`:
```bash
npm run dev
```
Lệnh trên sẽ tự động khởi chạy:
- **Backend Server:** `http://localhost:5000`
- **Frontend Client:** `http://localhost:5173`

---

### 2. Khởi chạy riêng lẻ từng phần

- **Chạy riêng Backend:**
  ```bash
  cd server
  npm run dev
  ```
- **Chạy riêng Frontend:**
  ```bash
  cd client
  npm run dev
  ```

---

### 3. Khởi tạo dữ liệu mẫu (Seeding Database)
Sau khi đảm bảo MongoDB đang chạy, bạn chạy lệnh sau tại thư mục gốc:
```bash
npm run seed
```
Hệ thống sẽ tạo sẵn 3 tài khoản tương ứng với 3 vai trò:

| Vai trò | Email | Mật khẩu | Chức năng |
|---------|-------|----------|-----------|
| **Admin** | `admin@crm.local` | `admin123` | Toàn quyền quản trị hệ thống, dự án, thành viên |
| **Manager** | `manager@crm.local` | `manager123` | Quản lý dự án, phân công việc, duyệt task |
| **Member** | `member@crm.local` | `member123` | Xem dự án được giao, cập nhật tiến độ Kanban |

> 💡 **Tính năng tiện ích:** Tại màn hình Đăng nhập (Login), có sẵn **3 nút 1-Click Login** để bạn chuyển đổi vai trò ngay lập tức mà không cần gõ mật khẩu.

---

## 📡 Danh Sách API Endpoints

### 🔐 Xác thực (Auth)
- `POST /api/auth/register` : Đăng ký tài khoản
- `POST /api/auth/login` : Đăng nhập & nhận JWT token
- `GET  /api/auth/me` : Lấy thông tin user hiện tại (Protected)
- `PUT  /api/auth/profile` : Cập nhật thông tin cá nhân (Protected)

### 📊 Thống kê (Dashboard)
- `GET  /api/dashboard/overview` : Tổng quan KPI, tỷ lệ hoàn thành, hoạt động gần đây

### 📁 Dự án (Projects)
- `GET    /api/projects` : Lấy danh sách dự án kèm tỷ lệ hoàn thành
- `POST   /api/projects` : Tạo dự án mới (Admin, Manager)
- `GET    /api/projects/:id` : Chi tiết dự án
- `PUT    /api/projects/:id` : Cập nhật dự án
- `DELETE /api/projects/:id` : Xóa dự án (Admin, Owner)

### 📝 Công việc (Tasks & Kanban)
- `GET    /api/tasks` : Lọc danh sách công việc theo dự án, trạng thái, mức ưu tiên
- `POST   /api/tasks` : Tạo công việc mới (Bắn event Socket.IO)
- `GET    /api/tasks/:id` : Chi tiết công việc
- `PUT    /api/tasks/:id` : Cập nhật công việc
- `PATCH  /api/tasks/:id/status` : Kéo thả / chuyển trạng thái cột Kanban
- `DELETE /api/tasks/:id` : Xóa công việc

### 👥 Nhân sự (Users)
- `GET   /api/users` : Danh sách cán bộ nhân viên
- `PATCH /api/users/:id/role` : Phân quyền Admin/Manager/Member
