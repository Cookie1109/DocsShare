# 📚 DocsShare - Nền tảng chia sẻ tài liệu thông minh

Một ứng dụng web hiện đại cho phép chia sẻ và quản lý tài liệu trong nhóm với giao diện trực quan, hệ thống tag thông minh và lưu trữ đám mây.

## 🚀 Tính năng nổi bật

- 🏷️ **Smart Tagging**: Tự động tạo và quản lý tags cho files
- ☁️ **Cloud Storage**: Lưu trữ files trên Cloudinary
- 👥 **Group Management**: Quản lý nhóm và thành viên
- 🔍 **Advanced Search**: Tìm kiếm files theo tags, loại file, thời gian
- 📊 **Activity Tracking**: Theo dõi hoạt động upload, download
- 🔐 **Firebase Auth**: Xác thực người dùng an toàn
- 📱 **Responsive Design**: Giao diện thân thiện trên mọi thiết bị

## 🛠️ Công nghệ sử dụng

### Frontend
- **React 18**: Framework UI hiện đại
- **Vite**: Build tool nhanh chóng  
- **TailwindCSS v4**: Styling utility-first
- **React Router**: Navigation
- **Lucide React**: Icons đẹp và nhất quán

### Backend
- **Node.js**: Runtime JavaScript server-side
- **Express.js**: Web framework RESTful API
- **MySQL**: Relational database với schema chuẩn hóa
- **Cloudinary**: Cloud storage cho files
- **Firebase Admin**: Authentication và user management
- **Multer**: File upload middleware

### Database & Storage
- **MySQL**: Primary database với schema tối ưu
- **Cloudinary**: Cloud file storage và CDN
- **Firebase Auth**: Service xác thực người dùng

## 📋 Tính năng chi tiết

### 🔐 Authentication & User Management
- Đăng nhập/đăng ký với Firebase Auth
- Profile management với display name và tag duy nhất
- Avatar upload và quản lý

### � Group Management  
- Tạo và quản lý nhóm
- Mời thành viên vào nhóm
- Phân quyền thành viên (creator, member)
- Rời nhóm và xóa nhóm

### 📁 File Management
- Upload files lên Cloudinary cloud storage
- Download files với tracking số lượt tải
- Xóa files (chỉ người upload và admin)
- Hỗ trợ mọi loại file (PDF, Word, Excel, hình ảnh, v.v.)

### 🏷️ Smart Tagging System
- **Auto-create tags**: Tự động tạo tags từ tên người dùng nhập
- **Tag reuse**: Sử dụng lại tags có sẵn trong nhóm
- **Group-scoped**: Tags riêng biệt cho từng nhóm
- **Flexible input**: Hỗ trợ nhiều format input (JSON, comma-separated)

### � Advanced Search & Filter
- Tìm kiếm files theo tags
- Lọc theo loại file (PDF, Word, Excel, v.v.)
- Sắp xếp theo thời gian, tên, lượt download
- Phân trang kết quả tìm kiếm

### 📊 Activity Tracking
- Ghi lại mọi hoạt động: upload, download, tạo nhóm, gắn tag
- Thống kê hoạt động của nhóm
- Audit trail đầy đủ cho quản trị

## 🚀 Cài đặt và chạy dự án

### Yêu cầu hệ thống
- Node.js 18+ 
- MySQL 8.0+
- Cloudinary account (free)
- Firebase project

### 1. Clone repository

```bash
git clone https://github.com/Cookie1109/DocsShare.git
cd DocsShare
```

### 2. Cài đặt Database

```bash
# Tạo database MySQL
mysql -u root -p
CREATE DATABASE docsshare_db;

# Import schema
mysql -u root -p docsshare_db < docsshare_db.sql
```

### 3. Backend Setup

```bash
cd backend
npm install

# Tạo file .env
cp .env.example .env
# Điền thông tin:
# - MySQL connection
# - Cloudinary credentials  
# - Firebase admin config

npm start
```

Server chạy tại: http://localhost:5000

### 4. Frontend Setup

```bash
cd frontend
npm install

# Cấu hình Firebase config trong src/config/firebase.js
npm run dev
```

Frontend chạy tại: http://localhost:5173

## 📁 Cấu trúc dự án

```
DocsShare/
├── 📁 frontend/                 # React frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── Chat/          # Chat và messaging
│   │   │   └── Layout/        # Layout components
│   │   ├── pages/             # Page components
│   │   ├── contexts/          # React contexts (Auth)
│   │   ├── services/          # API services
│   │   └── config/            # Firebase config
│   └── public/                # Static assets
├── 📁 backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── controllers/       # API controllers
│   │   ├── models/           # Database models
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth & upload middleware
│   │   └── config/           # DB & Cloudinary config
│   └── server.js             # Main server file
├── 📁 examples/               # Documentation & examples
├── 📄 docsshare_db.sql       # Database schema
└── 📄 README.md
```

## 🎨 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký người dùng mới
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/profile` - Lấy thông tin profile

### Groups
- `GET /api/groups` - Lấy danh sách nhóm của user
- `POST /api/groups` - Tạo nhóm mới
- `POST /api/groups/:id/join` - Tham gia nhóm
- `DELETE /api/groups/:id/leave` - Rời nhóm

### Files  
- `POST /api/files/upload` - Upload file với smart tagging
- `GET /api/groups/:groupId/files` - Lấy files của nhóm
- `GET /api/files/:id/download` - Download file
- `DELETE /api/files/:id` - Xóa file

### Tags
- `GET /api/groups/:groupId/tags` - Lấy tags của nhóm
- `POST /api/tags` - Tạo tag mới
- `GET /api/tags/:id/files` - Lấy files theo tag

### Activity
- `GET /api/activities` - Lấy log hoạt động

## 🏷️ Smart Tagging Usage

```javascript
// Upload file với tags
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('group_id', '123');
formData.append('tag_names', JSON.stringify([
  'báo cáo', 'tài chính', 'Q3-2024'
]));

fetch('/api/files/upload', {
  method: 'POST',
  body: formData
});
```

## 📊 Trạng thái phát triển

### ✅ Hoàn thành
- **Backend API**: Full RESTful API với Express.js
- **Database**: MySQL schema với relationships đầy đủ
- **Authentication**: Firebase Auth integration
- **File Storage**: Cloudinary cloud storage
- **Smart Tagging**: Auto-create và manage tags
- **Group Management**: Tạo, join, leave nhóm
- **Activity Logging**: Comprehensive audit trail
- **Search & Filter**: Advanced file search

### 🚧 Đang phát triển
- **Frontend Integration**: Kết nối React với backend API
- **Real-time Updates**: WebSocket cho live updates
- **File Preview**: Preview files trước khi download
- **Notification System**: Thông báo hoạt động

### 🔮 Kế hoạch tương lai
- **AI Auto-Tagging**: AI suggest tags cho files
- **Advanced Analytics**: Thống kê usage và insights
- **Mobile App**: React Native app
- **Collaboration Features**: Comments, sharing permissions

## 🎯 Demo & Usage

### Backend API Demo
```bash
# Start backend server
cd backend && npm start

# Test endpoints
curl http://localhost:5000/api/health
curl http://localhost:5000/api/groups
```

### Frontend Demo  
```bash
# Start frontend dev server
cd frontend && npm run dev
# Mở http://localhost:5173
```

## 📖 Hướng dẫn sử dụng

1. **Setup**: Cài đặt database và config theo hướng dẫn
2. **Register**: Tạo tài khoản với Firebase Auth
3. **Create Group**: Tạo nhóm mới hoặc join nhóm có sẵn
4. **Upload Files**: Upload files với smart tags
5. **Search**: Tìm kiếm files theo tags, type, time
6. **Manage**: Quản lý files, tags và thành viên nhóm

## 🤝 Đóng góp

Chúng tôi hoan nghênh mọi đóng góp! Để đóng góp:

1. Fork repository này
2. Tạo branch mới: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Tạo Pull Request

### 📝 Guidelines
- Viết code rõ ràng và có comment
- Tuân thủ coding standards hiện tại
- Thêm tests nếu cần thiết
- Update documentation khi cần

## 🐛 Bug Reports & Feature Requests

- **Bug Reports**: Tạo issue với label `bug`
- **Feature Requests**: Tạo issue với label `enhancement`
- **Questions**: Tạo issue với label `question`

## 📄 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI Framework
- [Express.js](https://expressjs.com/) - Backend Framework  
- [MySQL](https://mysql.com/) - Database
- [Cloudinary](https://cloudinary.com/) - Cloud Storage
- [Firebase](https://firebase.google.com/) - Authentication
- [Lucide Icons](https://lucide.dev/) - Beautiful Icons
- [TailwindCSS](https://tailwindcss.com/) - CSS Framework

**DocsShare** - Nền tảng chia sẻ tài liệu thông minh 🚀  
*Chia sẻ kiến thức, Phát triển cùng nhau*
