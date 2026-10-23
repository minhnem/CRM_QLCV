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

