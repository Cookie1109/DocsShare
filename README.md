# DocsShare

Ứng dụng chia sẻ tài liệu với AI Chatbot hỗ trợ tìm kiếm thông minh, sử dụng Firebase Authentication và MySQL database.

## 📋 Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt](#cài-đặt)
- [Cấu hình](#cấu-hình)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [API Documentation](#api-documentation)

## ✨ Tính năng

- 🔐 Xác thực người dùng với Firebase Authentication
- 📁 Upload và quản lý tài liệu (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, RAR)
- 👥 Tạo và quản lý nhóm chia sẻ
- 🏷️ Gắn tags cho tài liệu
- 🤖 AI Chatbot hỗ trợ tìm kiếm tài liệu thông minh (Gemini AI)
- 💬 Chat realtime trong nhóm
- 📊 Theo dõi hoạt động và thống kê
- ☁️ Lưu trữ file trên Cloudinary
- 🔄 Đồng bộ dữ liệu giữa Firebase và MySQL

## 🛠️ Công nghệ sử dụng

### Frontend
- React 19.1.1
- Vite 7.1.2
- React Router DOM 7.8.2
- Tailwind CSS 4.1.13
- Axios 1.13.1
- Lucide React (Icons)

### Backend
- Node.js + Express 5.1.0
- Firebase Admin SDK 13.6.0
- MySQL2 3.15.3
- Google Generative AI 0.24.1 (Gemini)
- Cloudinary 1.41.3
- JWT Authentication
- Multer (File upload)

### Database
- MySQL (Primary database)
- Firebase Realtime Database (Realtime sync)

## 📦 Yêu cầu hệ thống

- Node.js >= 18.x
- npm >= 9.x
- MySQL >= 8.0
- Firebase Project
- Cloudinary Account
- Google AI Studio API Key (Gemini)

## 🚀 Cài đặt

### 1. Clone repository
```bash
git clone https://github.com/Cookie1109/DocsShare.git
cd DocsShare
```

### 2. Cài đặt dependencies

#### Root project
```bash
npm install
```

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

## ⚙️ Cấu hình

### 1. Tạo MySQL Database

```sql
CREATE DATABASE docsshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Chạy migration file để tạo các bảng:

```bash
mysql -u root -p docsshare < backend/migrations/docsshare_db.sql
```

### 2. Cấu hình Firebase

1. Tạo project tại [Firebase Console](https://console.firebase.google.com)
2. Bật **Authentication** (Email/Password và Google)
3. Bật **Realtime Database**
4. Tải **Service Account Key** (Settings > Service Accounts > Generate new private key)
5. Lưu file JSON vào `backend/` với tên `docsshare-35adb-firebase-adminsdk-fbsvc-fd8bf7b45f.json` (hoặc đổi tên trong code)

### 3. Cấu hình Cloudinary

1. Tạo tài khoản tại [Cloudinary](https://cloudinary.com)
2. Lấy **Cloud Name**, **API Key**, **API Secret** từ Dashboard

### 4. Cấu hình Google AI (Gemini)

1. Truy cập [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Tạo API Key mới

### 5. Tạo file `.env` cho Backend

Tạo file `backend/.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5174

# JWT Configuration
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=26214400
ALLOWED_FILE_TYPES=pdf,doc,docx,ppt,pptx,xls,xlsx,zip,rar

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK
FIREBASE_ADMIN_TYPE=service_account
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_CLIENT_ID=your_client_id

# MySQL Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=docsshare
DB_PORT=3306
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# API Configuration
API_VERSION=v1

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key
```

### 6. Cấu hình Frontend

Tạo file `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

## 🏃 Chạy ứng dụng

### Development Mode

#### Chạy Backend
```bash
cd backend
npm start
# hoặc với nodemon
npm run dev
```

Backend sẽ chạy tại: `http://localhost:5000`

#### Chạy Frontend
```bash
cd frontend
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

### Production Build

#### Build Frontend
```bash
cd frontend
npm run build
```

#### Chạy Backend (Production)
```bash
cd backend
NODE_ENV=production npm start
```

## 📁 Cấu trúc thư mục

```
DocsShare/
├── backend/
│   ├── src/
│   │   ├── config/           # Database, Firebase, Cloudinary config
│   │   ├── controllers/      # Route controllers
│   │   ├── middleware/       # Authentication & validation
│   │   ├── models/          # Database models
│   │   └── routes/          # API routes
│   ├── migrations/          # Database migrations
│   ├── uploads/             # Temporary file uploads
│   ├── server.js           # Entry point
│   ├── .env                # Environment variables (không commit)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── config/         # Firebase config
│   │   └── assets/         # Static assets
│   ├── public/
│   ├── .env                # Environment variables (không commit)
│   └── package.json
│
├── .gitignore
├── package.json
└── README.md
```

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Users
- `GET /api/users` - Lấy danh sách users
- `GET /api/users/:id` - Lấy thông tin user
- `PUT /api/users/:id` - Cập nhật thông tin user

### Groups
- `GET /api/groups` - Lấy danh sách nhóm
- `POST /api/groups` - Tạo nhóm mới
- `GET /api/groups/:id` - Lấy thông tin nhóm
- `PUT /api/groups/:id` - Cập nhật nhóm
- `DELETE /api/groups/:id` - Xóa nhóm

### Files
- `GET /api/files` - Lấy danh sách files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id` - Lấy thông tin file
- `DELETE /api/files/:id` - Xóa file
- `GET /api/files/:id/download` - Download file

### Tags
- `GET /api/tags` - Lấy danh sách tags
- `POST /api/tags` - Tạo tag mới
- `PUT /api/tags/:id` - Cập nhật tag
- `DELETE /api/tags/:id` - Xóa tag

### Chatbot
- `POST /api/chatbot/chat` - Gửi tin nhắn đến AI chatbot
- `GET /api/chatbot/stats` - Lấy thống kê files

### Activities
- `GET /api/activities` - Lấy lịch sử hoạt động

## 🔒 Bảo mật

- ✅ File `.env` đã được thêm vào `.gitignore`
- ✅ JWT tokens cho authentication
- ✅ Firebase Admin SDK cho server-side auth
- ✅ Helmet.js cho security headers
- ✅ CORS configuration
- ✅ Input validation với express-validator

## 🤝 Đóng góp

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📝 License

Project này được phát triển cho mục đích học tập.

## 👥 Tác giả

- GitHub: [@Cookie1109](https://github.com/Cookie1109)

## 🐛 Báo lỗi

Nếu gặp vấn đề, vui lòng tạo issue tại [GitHub Issues](https://github.com/Cookie1109/DocsShare/issues)

## 📞 Liên hệ

- Email: your-email@example.com
- GitHub: [Cookie1109](https://github.com/Cookie1109)

---

⭐ Nếu thấy project hữu ích, đừng quên star repo nhé!
