# Phân Tích Hệ Thống Xác Thực Người Dùng - DocsShare

## 📋 Tổng Quan

DocsShare sử dụng **hệ thống xác thực lai (Hybrid Authentication)** kết hợp **Firebase Authentication** cho frontend và **Firebase Admin SDK** cho backend, với sự hỗ trợ từ **MySQL** để lưu trữ dữ liệu người dùng bổ sung.

### Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Firebase Auth SDK (Client)                          │   │
│  │  - signInWithEmailAndPassword()                      │   │
│  │  - signInWithPopup(GoogleAuthProvider)              │   │
│  │  - createUserWithEmailAndPassword()                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AuthContext (React Context)                         │   │
│  │  - Quản lý trạng thái đăng nhập                      │   │
│  │  - Lấy ID Token từ Firebase                          │   │
│  │  - Realtime listener cho user profile                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ 
              Authorization: Bearer <Firebase_ID_Token>
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware: verifyFirebaseToken                     │   │
│  │  - admin.auth().verifyIdToken()                      │   │
│  │  - Giải mã token → req.user                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Controllers & Routes                                │   │
│  │  - Truy cập req.user.uid, req.user.email             │   │
│  │  - Xử lý business logic                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Database Layer                                       │   │
│  │  MySQL (Persistence) + Firestore (Realtime)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Phương Thức Xác Thực

### 1. **Email/Password Authentication**

#### Frontend Flow
```javascript
// File: frontend/src/services/firebase.js
export const signUpWithEmail = async (email, displayName, userTag, password) => {
  // 1. Tạo user với Firebase Authentication
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;
  
  // 2. Tạo user profile trong Firestore
  const userData = {
    uid: user.uid,
    email: user.email,
    displayName: displayName,
    userTag: userTag,
    username: `${displayName}#${userTag}`,
    avatar: null,
    role: 'member',
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp()
  };
  
  await setDoc(doc(db, 'users', user.uid), userData);
  
  // 3. Sync sang MySQL backend (background)
  const token = await user.getIdToken();
  fetch('http://localhost:5000/api/profile/complete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ displayName, tag: userTag })
  });
}
```

**Đăng nhập:**
```javascript
export const signInWithCredentials = async (usernameOrEmail, password) => {
  // Hỗ trợ đăng nhập bằng username#tag hoặc email
  // Nếu là username#tag → Query Firestore để lấy email → Đăng nhập
  let email = usernameOrEmail;
  
  if (!usernameOrEmail.includes('@')) {
    // Query Firestore để tìm email từ username
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', usernameOrEmail));
    const snapshot = await getDocs(q);
    email = snapshot.docs[0]?.data().email;
  }
  
  // Đăng nhập với Firebase
  return await signInWithEmailAndPassword(auth, email, password);
}
```

### 2. **Google OAuth Authentication**

```javascript
// File: frontend/src/services/firebase.js
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  
  // Kiểm tra user đã có profile chưa
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  
  if (!userDoc.exists()) {
    // Tạo profile mới cho lần đầu đăng nhập Google
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      avatar: user.photoURL,
      role: 'member',
      createdAt: serverTimestamp()
    });
  }
  
  return { success: true, user };
}
```

---

## 🔐 Backend Authentication Middleware

### Firebase Token Verification

```javascript
// File: backend/src/middleware/firebaseAuth.js
const verifyFirebaseToken = async (req, res, next) => {
  // 1. Lấy token từ header
  const authHeader = req.headers.authorization;
  const idToken = authHeader.split('Bearer ')[1];
  
  // 2. Verify token với Firebase Admin SDK
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  
  // 3. Gắn user info vào request
  req.user = {
    id: decodedToken.uid,
    uid: decodedToken.uid,
    email: decodedToken.email,
    displayName: decodedToken.name || decodedToken.email,
    avatar: decodedToken.picture || null,
    emailVerified: decodedToken.email_verified
  };
  
  next();
}
```

### Legacy JWT Middleware (Không còn dùng chính)

```javascript
// File: backend/src/middleware/auth.js
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}
```

**Lưu ý:** Middleware JWT cũ chỉ còn dùng cho một số route legacy (`/api/users`). Hầu hết các route mới đều dùng Firebase Auth.

---

## 🔄 Authentication Flow Chi Tiết

### Flow Đăng Ký (Sign Up)

```
1. USER nhập thông tin (email, password, displayName, userTag)
   ↓
2. FRONTEND gọi createUserWithEmailAndPassword(auth, email, password)
   ↓
3. FIREBASE AUTH tạo user account → Trả về user.uid
   ↓
4. FRONTEND tạo document trong Firestore: users/{uid}
   {
     uid, email, displayName, userTag, 
     username: "displayName#userTag",
     role: 'member',
     createdAt, lastActive
   }
   ↓
5. FRONTEND lấy ID Token: user.getIdToken()
   ↓
6. FRONTEND gọi BACKEND: POST /api/profile/complete
   Headers: { Authorization: Bearer <token> }
   Body: { displayName, tag }
   ↓
7. BACKEND verify token → Lưu thông tin vào MySQL
   ↓
8. USER được redirect vào ứng dụng
```

### Flow Đăng Nhập (Sign In)

```
1. USER nhập username#tag hoặc email + password
   ↓
2. FRONTEND kiểm tra:
   - Nếu là username#tag → Query Firestore để lấy email
   - Nếu là email → Dùng trực tiếp
   ↓
3. FRONTEND gọi signInWithEmailAndPassword(auth, email, password)
   ↓
4. FIREBASE AUTH xác thực → Trả về user object
   ↓
5. FRONTEND set up onAuthStateChanged listener
   ↓
6. AuthContext cập nhật:
   - setUser({ uid, email, displayName, ... })
   - loadUserGroups()
   ↓
7. Mọi API call sau đó đều attach: 
   Authorization: Bearer <Firebase_ID_Token>
```

### Flow Google Sign In

```
1. USER click "Đăng nhập với Google"
   ↓
2. FRONTEND gọi signInWithPopup(auth, googleProvider)
   ↓
3. FIREBASE mở popup Google OAuth
   ↓
4. USER chọn tài khoản Google
   ↓
5. FIREBASE trả về user với:
   - user.uid
   - user.email
   - user.displayName
   - user.photoURL
   ↓
6. FRONTEND kiểm tra Firestore: users/{uid} có tồn tại không?
   ↓
7a. Nếu CHƯA → Tạo profile mới trong Firestore
7b. Nếu ĐÃ CÓ → Load profile hiện tại
   ↓
8. AuthContext cập nhật state
   ↓
9. USER vào ứng dụng
```

---

## 📊 Dual Database Strategy

### Firestore (Realtime)
- **Mục đích:** Realtime synchronization, UI updates
- **Dữ liệu lưu:**
  - `users/{uid}`: Profile, avatar, username, lastActive
  - `group_members/{id}`: Thành viên nhóm (realtime)
  - `groups/{groupId}/files`: Files metadata
  - `groups/{groupId}/messages`: Chat messages

### MySQL (Persistence)
- **Mục đích:** Complex queries, relationships, persistence
- **Dữ liệu lưu:**
  - `users`: User profiles
  - `groups`: Group information
  - `group_members`: Group memberships
  - `files`: File metadata với download count
  - `group_invitations`: Invitations

**Sync Strategy:**
```javascript
// Backend tự động sync sau mỗi thao tác
// Ví dụ: Khi tạo member mới
async addMember(groupId, userId, role) {
  // 1. Insert vào MySQL
  await connection.execute(
    'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
    [groupId, userId, role]
  );
  
  // 2. Sync sang Firestore
  await syncGroupMember(groupId, userId, 'CREATE', { role });
}
```

---

## 🛡️ Security Features

### 1. Token Expiration
- Firebase ID Token tự động expire sau **1 giờ**
- Frontend tự động refresh token khi cần:
```javascript
const token = await auth.currentUser.getIdToken(/* forceRefresh */ true);
```

### 2. Token Verification
```javascript
// Backend verify mọi request
const decodedToken = await admin.auth().verifyIdToken(idToken);
// Kiểm tra:
// - Token chưa expire
// - Token hợp lệ
// - User chưa bị xóa
// - Email verified (nếu cần)
```

### 3. Role-Based Access Control (RBAC)

```javascript
// Middleware kiểm tra role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Sử dụng
router.delete('/:userId', verifyFirebaseToken, requireAdmin, deleteUser);
```

### 4. Group-Level Permissions
```javascript
// Kiểm tra user có quyền trong nhóm không
const canUserEditGroup = async (groupId, userId) => {
  const member = await getMemberRole(groupId, userId);
  return member?.role === 'admin' || member?.role === 'creator';
};
```

---

## 🔌 API Routes Protection

### Protected Routes (Cần xác thực)

```javascript
// File: backend/src/routes/groupsNew.js
const verifyFirebaseToken = require('../middleware/firebaseAuth');

// Áp dụng cho TẤT CẢ routes trong router này
router.use(verifyFirebaseToken);

// Các routes tự động được bảo vệ
router.post('/', createGroup);           // Tạo nhóm
router.get('/my-groups', getMyGroups);   // Lấy nhóm của tôi
router.post('/:groupId/leave', leaveGroup); // Rời nhóm
```

### Legacy Protected Routes (JWT)

```javascript
// File: backend/src/routes/users.js
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Chỉ admin mới truy cập được
router.get('/', authenticateToken, requireAdmin, getAllUsers);
router.delete('/:id', authenticateToken, requireAdmin, deleteUser);
```

---

## 📱 Frontend State Management

### AuthContext Provider

```javascript
// File: frontend/src/contexts/AuthContext.jsx
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 1. Firebase Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Optimistic UI: Set basic info ngay
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Loading...',
          loading: true
        });
        setLoading(false);  // Cho phép UI render
        
        // Load full data từ Firestore trong background
        const userData = await getUserData(firebaseUser.uid);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          ...userData.data,
          loading: false
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  // 2. Realtime Firestore Listener cho user profile
  useEffect(() => {
    if (!user?.uid) return;
    
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const updatedData = docSnapshot.data();
        setUser(prev => ({
          ...prev,
          ...updatedData,
          name: updatedData.username || prev?.name
        }));
      }
    });
    
    return () => unsubscribe();
  }, [user?.uid]);
  
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, ... }}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## 🧪 Use Cases & Examples

### Use Case 1: Gửi API Request
```javascript
// Component bất kỳ
const { user } = useAuth();

const uploadFile = async (file) => {
  // Lấy token từ Firebase
  const token = await auth.currentUser.getIdToken();
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('http://localhost:5000/api/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};
```

### Use Case 2: Kiểm tra quyền trên frontend
```javascript
const { user, checkUserRole } = useAuth();

const GroupSettings = ({ groupId }) => {
  const userRole = checkUserRole(groupId);
  
  if (userRole !== 'admin' && userRole !== 'creator') {
    return <div>Bạn không có quyền truy cập</div>;
  }
  
  return <AdminPanel />;
};
```

### Use Case 3: Backend validate quyền
```javascript
// Backend route
router.delete('/:groupId', verifyFirebaseToken, async (req, res) => {
  const userId = req.user.uid;  // Từ decoded token
  const { groupId } = req.params;
  
  // Kiểm tra user có phải creator không
  const group = await getGroup(groupId);
  if (group.creator_id !== userId) {
    return res.status(403).json({ error: 'Only creator can delete group' });
  }
  
  await deleteGroup(groupId);
  res.json({ success: true });
});
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Token Expired
**Lỗi:** `auth/id-token-expired`

**Giải pháp:**
```javascript
// Frontend tự động refresh
try {
  const token = await auth.currentUser.getIdToken(true); // forceRefresh
  // Retry API call
} catch (error) {
  // Redirect to login
  logout();
}
```

### Issue 2: User Not Found
**Lỗi:** User đăng nhập thành công nhưng không có data trong Firestore

**Nguyên nhân:** Profile chưa được tạo sau khi sign up

**Giải pháp:**
```javascript
// Trong AuthContext, kiểm tra và tạo profile nếu thiếu
const userData = await getUserData(firebaseUser.uid);
if (!userData.success) {
  // Tạo profile default
  await createDefaultProfile(firebaseUser.uid);
}
```

### Issue 3: CORS Error
**Lỗi:** CORS policy blocks request

**Giải pháp:**
```javascript
// Backend: backend/server.js
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

---

## 🔄 Migration Path (Legacy → Firebase)

Một số route cũ vẫn dùng JWT authentication. Dưới đây là kế hoạch migrate:

### Routes đang dùng JWT (cần migrate)
- `/api/users/*` - User management
- `/api/documents/*` - Document routes (nếu có)

### Routes đã dùng Firebase
- `/api/groups/*` ✅
- `/api/files/*` ✅
- `/api/profile/*` ✅
- `/api/sync/*` ✅

### Migration Steps
1. Thêm `verifyFirebaseToken` middleware
2. Update controllers để dùng `req.user.uid` thay vì `req.user.id`
3. Test thoroughly
4. Remove JWT middleware

---

## 📈 Performance Optimizations

### 1. Optimistic UI Updates
```javascript
// Không chờ API response, update UI ngay
setUser({ ...newUserData });
updateUserProfile(newUserData); // Background
```

### 2. Token Caching
```javascript
// Firebase SDK tự động cache token
// Chỉ refresh khi cần
const token = await auth.currentUser.getIdToken(); // Dùng cache
const freshToken = await auth.currentUser.getIdToken(true); // Force refresh
```

### 3. Parallel Data Loading
```javascript
// Load nhiều data cùng lúc
await Promise.all([
  loadUserGroups(),
  loadUserProfile(),
  checkProfileStatus()
]);
```

---

## 🎓 Best Practices

### ✅ DO
1. **Luôn verify token trên backend** - Không tin tưởng frontend
2. **Sử dụng HTTPS** trong production
3. **Refresh token khi cần** - Tránh token expired
4. **Log authentication events** - Để debug và audit
5. **Handle errors gracefully** - Redirect to login khi unauthorized

### ❌ DON'T
1. **Không lưu token trong localStorage** - Dễ bị XSS
2. **Không expose Firebase Admin credentials** - Chỉ dùng trên backend
3. **Không skip token verification** - Luôn verify mọi request
4. **Không hardcode credentials** - Dùng environment variables
5. **Không trust client-side role checks** - Luôn verify trên server

---

## 🔮 Future Enhancements

### Planned Features
1. **Multi-Factor Authentication (MFA)**
   - SMS OTP
   - Authenticator apps

2. **Session Management**
   - Revoke sessions
   - Device management
   - "Log out all devices"

3. **OAuth Providers**
   - Facebook Login
   - GitHub Login
   - Microsoft Account

4. **Rate Limiting**
   - Prevent brute force attacks
   - API rate limits per user

5. **Audit Logs**
   - Track login attempts
   - Track permission changes
   - Security event logging

---

## 📚 References

### Documentation
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

### Code Files
- **Frontend Auth:** `frontend/src/contexts/AuthContext.jsx`
- **Firebase Services:** `frontend/src/services/firebase.js`
- **Firebase Config:** `frontend/src/config/firebase.js`
- **Backend Middleware:** `backend/src/middleware/firebaseAuth.js`
- **Firebase Admin:** `backend/src/config/firebaseAdmin.js`
- **Legacy Auth:** `backend/src/middleware/auth.js`

---

**Ngày cập nhật:** 13/11/2025  
**Version:** 1.0  
**Tác giả:** DocsShare Development Team
