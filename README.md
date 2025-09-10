# Docs Share - Chia sẻ tài liệu học tập

Một ứng dụng chat nhóm đơn giản để chia sẻ tài liệu học tập, với giao diện tương tự Zalo nhưng chỉ hỗ trợ gửi file.

## Công nghệ sử dụng

### Frontend
- **React**: Framework UI hiện đại
- **Vite**: Build tool nhanh chóng  
- **TailwindCSS v4**: Styling utility-first
- **React Router**: Navigation
- **Lucide React**: Icons đẹp

### Backend (dự kiến)
- **Node.js**: Runtime JavaScript
- **Express.js**: Web framework
- **Firebase**: Database và authentication
- **bcryptjs**: Password hashing
- **Helmet**: Security headers

### Database (Planned)
- **Firebase Firestore**: NoSQL database
- **Firebase Storage**: File storage
- **Firebase Auth**: Authentication service

## Tính năng chính

- � Đăng nhập/đăng ký người dùng
- 💬 Chat nhóm chia sẻ file
- 📂 Upload và chia sẻ tài liệu
- 🔍 Tìm kiếm nhóm
- ➕ Tạo nhóm mới
- 📱 Responsive design
- 🎨 Giao diện giống Zalo

## Cài đặt và chạy dự án

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Mở http://localhost:5173 để xem ứng dụng.

### Backend (đang phát triển)

```bash
cd backend
npm install
npm start
```

## Cấu trúc dự án

```
DocsShare/
├── frontend/           # React frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   │   ├── Chat/   # Chat components
│   │   │   ├── Layout/ # Layout components
│   │   │   └── Auth/   # Auth components
│   │   ├── pages/      # Page components
│   │   ├── contexts/   # React contexts
│   │   └── utils/      # Utility functions
│   └── public/         # Static assets
├── backend/            # Node.js backend (dự kiến)
└── README.md
```

## Giao diện

- **Landing Page**: Trang chủ giới thiệu với thiết kế hiện đại
- **Login/Register**: Đăng nhập và đăng ký với form đẹp
- **Chat Page**: Giao diện chat chính với:
  - Sidebar nhóm bên trái (màu xanh lá)
  - Khung chat chính bên phải
  - Auto-select nhóm đầu tiên
  - Logic hiển thị file: file mình gửi bên phải, file người khác bên trái
  - Auto-scroll xuống file mới nhất

## Layout đặc biệt

- **ChatPage**: Không cuộn, logo và tên web đứng yên
- **Sidebar**: Chỉ danh sách nhóm cuộn được
- **Chat Area**: Chỉ khung tin nhắn cuộn được
- **Header và Input**: Luôn cố định

## Trạng thái phát triển

- ✅ UI/UX cơ bản hoàn thiện
- ✅ Routing và authentication flow
- ✅ Layout responsive
- ✅ Chat interface với logic file
- ✅ Auto-scroll và layout optimization
- ⏳ Backend API
- ⏳ Real-time messaging
- ⏳ File upload/download thực tế
- ⏳ Firebase integration

## Demo

Chạy `npm run dev` trong thư mục `frontend` và mở http://localhost:5173 để xem demo.

## Hướng dẫn sử dụng

1. **Landing Page**: Trang chủ giới thiệu ứng dụng
2. **Đăng nhập**: Click "Đăng nhập" để vào trang login
3. **Chat**: Sau khi đăng nhập sẽ tự động chuyển về trang chat
4. **Chọn nhóm**: Nhóm đầu tiên sẽ được chọn tự động
5. **Gửi file**: Click icon upload để gửi file (UI only)
6. **Tạo nhóm**: Click "Tạo nhóm mới" để tạo nhóm mới

## Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng tạo issue hoặc pull request.

## License

MIT License - xem file LICENSE để biết thêm chi tiết.
- [Lucide Icons](https://lucide.dev/)

---

**DocsShare** - Chia sẻ kiến thức, Phát triển cùng nhau 🚀
