# Hệ thống Phân quyền trong Nhóm (Group Permission System)

## Tổng quan
Phân tích hệ thống phân quyền hiện tại trong dự án DocsShare. Hệ thống này quản lý quyền hạn của thành viên trong nhóm dựa trên vai trò (role) được lưu trong database MySQL và đồng bộ với Firebase.

**Kiến trúc hệ thống:**
- Backend: MySQL + Firebase Firestore (dual database)
- Authentication: Firebase Authentication
- Sync: Tự động đồng bộ giữa MySQL và Firebase

---

## 1. Các vai trò (Roles) hiện tại

Dựa vào schema database và code, hệ thống hiện tại có **2 vai trò chính**:

### 1.1. Admin (Quản trị viên / Chủ nhóm)

**Đặc điểm:**
- Người tạo nhóm tự động trở thành admin
- Được lưu trong bảng `group_members` với `role = 'admin'`
- Có thể có nhiều admin trong 1 nhóm
- Creator được lưu riêng trong `groups.creator_id`

**Quyền hạn hiện tại trong code:**
- ✅ Thêm thành viên vào nhóm (`Group.addMember`)
- ✅ Xóa thành viên khỏi nhóm (`Group.removeMember`)
- ✅ Thay đổi role thành viên (`Group.updateMemberRole`)
- ✅ Cập nhật thông tin nhóm (`Group.update`)
- ✅ Xóa nhóm (`Group.delete`) - admin và creator đều có thể xóa
- ✅ Quản lý files, tags, documents

**Ràng buộc đặc biệt:**
- Creator không thể bị xóa khỏi nhóm (có check trong `removeMember`)
- Không thể thay đổi role của creator (có check trong `updateMemberRole`)

### 1.2. Member (Thành viên)

**Đặc điểm:**
- Thành viên thông thường khi được thêm/mời vào nhóm
- Được lưu trong bảng `group_members` với `role = 'member'`
- Mặc định khi accept invitation

**Quyền hạn hiện tại:**
- ✅ Xem nội dung nhóm
- ✅ Upload files
- ✅ Tạo documents
- ✅ Thêm tags
- ✅ Rời khỏi nhóm (self-remove)
- ❌ Không thể thêm/xóa thành viên khác
- ❌ Không thể thay đổi role
- ❌ Không thể cập nhật thông tin nhóm
- ❌ Không thể xóa nhóm

### 1.3. Ma trận quyền thực tế (dựa trên code)

| Hành động | Creator | Admin | Member |
|-----------|---------|-------|--------|
| **Quản lý nhóm** |
| Xóa nhóm | ✅ | ✅ | ❌ |
| Cập nhật tên/mô tả nhóm | ✅ | ✅ | ❌ |
| **Quản lý thành viên** |
| Thêm thành viên | ✅ | ✅ | ❌ |
| Xóa thành viên | ✅ | ✅¹ | ❌ |
| Thay đổi role thành viên | ✅ | ✅² | ❌ |
| Xóa creator | ❌ | ❌ | ❌ |
| Rời khỏi nhóm | ❌³ | ✅ | ✅ |
| **Mời thành viên** |
| Gửi lời mời | ✅ | ✅ | ❌ |
| Chấp nhận lời mời | - | - | ✅⁴ |
| **Nội dung** |
| Upload files | ✅ | ✅ | ✅ |
| Tạo documents | ✅ | ✅ | ✅ |
| Tạo tags | ✅ | ✅ | ✅ |

**Chú thích:**
- ✅ = Có quyền
- ❌ = Không có quyền  
¹ Admin có thể xóa member nhưng không thể xóa creator  
² Admin có thể thay đổi role nhưng không thể thay đổi role của creator  
³ Creator không thể tự rời khỏi nhóm (có check trong code)  
⁴ Người được mời có thể chấp nhận/từ chối lời mời

---

## 2. Database Schema thực tế

### 2.1. Bảng `groups`
```sql
CREATE TABLE `groups` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_photo_url VARCHAR(255) NULL COMMENT 'Stored in Firebase only',
    creator_id VARCHAR(128) NOT NULL,  -- Firebase UID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (creator_id) REFERENCES users(id) 
      ON DELETE RESTRICT ON UPDATE CASCADE
);
```

**Lưu ý:**
- `creator_id` được lưu riêng để identify người tạo nhóm
- `group_photo_url` chỉ lưu trong Firebase, MySQL giữ placeholder
- `ON DELETE RESTRICT` ngăn xóa creator nếu còn nhóm

### 2.2. Bảng `group_members`
```sql
CREATE TABLE group_members (
    group_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,  -- Firebase UID
    `role` ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (group_id, user_id),
    
    FOREIGN KEY (group_id) REFERENCES `groups`(id) 
      ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) 
      ON DELETE CASCADE ON UPDATE CASCADE
);
```

**Đặc điểm:**
- Chỉ có 2 role: `admin` và `member`
- Creator cũng có record trong bảng này với `role = 'admin'`
- Composite primary key ngăn duplicate membership
- CASCADE delete khi xóa group hoặc user

### 2.3. Bảng `group_invitations`
```sql
CREATE TABLE group_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  inviter_id VARCHAR(255) NOT NULL,  -- Firebase UID
  invitee_id VARCHAR(255) NOT NULL,  -- Firebase UID
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  
  -- Ngăn duplicate pending invitations
  UNIQUE KEY unique_pending_invitation (group_id, invitee_id, status),
  
  INDEX idx_invitee (invitee_id, status),
  INDEX idx_group (group_id, status)
);
```

**Đặc điểm:**
- 3 trạng thái: `pending`, `accepted`, `declined`
- UNIQUE constraint ngăn gửi nhiều lời mời pending cho cùng 1 người
- Tự động xóa khi group bị xóa (CASCADE)

---

## 3. Luồng kiểm tra quyền trong code

### 3.1. Middleware xác thực Firebase

```javascript
// backend/src/middleware/firebaseAuth.js
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};
```

**Được áp dụng:**
- Tất cả routes trong `groupsNew.js`, `invitations.js`
- Đảm bảo user đã đăng nhập qua Firebase

### 3.2. Kiểm tra quyền trong Model

Tất cả logic kiểm tra quyền được implement **trực tiếp trong Model** thay vì dùng middleware riêng.

#### Ví dụ 1: Thêm thành viên (`Group.addMember`)

```javascript
static async addMember(groupId, userId, addedBy) {
  return await executeTransaction(async (connection) => {
    // 1. Kiểm tra người thêm phải là admin
    const [adminCheck] = await connection.execute(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, addedBy]
    );
    
    if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
      throw new Error('Only admins can add members');
    }
    
    // 2. Kiểm tra user đã là thành viên chưa
    const [existingMember] = await connection.execute(
      `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (existingMember.length > 0) {
      throw new Error('User is already a member of this group');
    }
    
    // 3. Thêm thành viên với role = 'member'
    await connection.execute(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, 'member', NOW())`,
      [groupId, userId]
    );
    
    // 4. Sync to Firebase
    await syncGroupMember(groupId, userId, 'CREATE', { role: 'member' });
    
    return { success: true, message: 'Member added successfully' };
  });
}
```

**Logic kiểm tra:**
1. ✅ Kiểm tra `addedBy` là admin của nhóm
2. ✅ Kiểm tra user chưa là thành viên
3. ✅ Thêm với role mặc định là `member`
4. ✅ Đồng bộ sang Firebase

#### Ví dụ 2: Xóa thành viên (`Group.removeMember`)

```javascript
static async removeMember(groupId, userId, removedBy) {
  return await executeTransaction(async (connection) => {
    // 1. Kiểm tra quyền xóa (admin hoặc tự rời nhóm)
    if (userId !== removedBy) {
      const [adminCheck] = await connection.execute(
        `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, removedBy]
      );
      
      if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
        throw new Error('Only admins can remove members');
      }
    }
    
    // 2. Kiểm tra không thể xóa creator
    const [creatorCheck] = await connection.execute(
      `SELECT creator_id FROM \`groups\` WHERE id = ?`,
      [groupId]
    );
    
    if (creatorCheck.length > 0 && creatorCheck[0].creator_id === userId) {
      throw new Error('Group creator cannot be removed. Transfer ownership first.');
    }
    
    // 3. Xóa thành viên
    const [result] = await connection.execute(
      `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('User is not a member of this group');
    }
    
    // 4. Sync to Firebase
    await syncGroupMember(groupId, userId, 'DELETE', null);
    
    return {
      success: true,
      message: userId === removedBy ? 'Left group successfully' : 'Member removed successfully'
    };
  });
}
```

**Logic kiểm tra:**
1. ✅ Nếu xóa người khác → phải là admin
2. ✅ Nếu tự rời nhóm → cho phép
3. ✅ Không thể xóa creator (protection)
4. ✅ Đồng bộ sang Firebase

#### Ví dụ 3: Thay đổi role (`Group.updateMemberRole`)

```javascript
static async updateMemberRole(groupId, userId, newRole, updatedBy) {
  return await executeTransaction(async (connection) => {
    // 1. Kiểm tra quyền update (chỉ admin)
    const [adminCheck] = await connection.execute(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, updatedBy]
    );
    
    if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
      throw new Error('Only admins can update member roles');
    }
    
    // 2. Không thể thay đổi role của creator
    const [creatorCheck] = await connection.execute(
      `SELECT creator_id FROM \`groups\` WHERE id = ?`,
      [groupId]
    );
    
    if (creatorCheck.length > 0 && creatorCheck[0].creator_id === userId) {
      throw new Error('Cannot change role of group creator');
    }
    
    // 3. Cập nhật role
    const [result] = await connection.execute(
      `UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`,
      [newRole, groupId, userId]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('User is not a member of this group');
    }
    
    // 4. Sync to Firebase
    await syncGroupMember(groupId, userId, 'UPDATE', { role: newRole });
    
    return { success: true, message: 'Member role updated successfully' };
  });
}
```

**Logic kiểm tra:**
1. ✅ Chỉ admin mới có thể thay đổi role
2. ✅ Không thể thay đổi role của creator (protection)
3. ✅ Update role (có thể thăng/giáng)
4. ✅ Đồng bộ sang Firebase

### 3.3. Kiểm tra quyền trong Routes

Routes chỉ validate input và gọi Model methods:

```javascript
// backend/src/routes/groupsNew.js

// Xóa thành viên
router.delete('/:groupId/members/:userId', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const removedBy = req.user.id;  // Từ Firebase auth middleware
    
    const result = await Group.removeMember(
      parseInt(groupId),
      userId,
      removedBy
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Thay đổi role
router.patch('/:groupId/members/:userId/role', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;
    const updatedBy = req.user.id;
    
    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be admin or member'
      });
    }
    
    const result = await Group.updateMemberRole(
      parseInt(groupId),
      userId,
      role,
      updatedBy
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

**Pattern:**
- Route nhận request và extract params
- Validate input cơ bản (role values, required fields)
- Gọi Model method với user ID từ Firebase token
- Model tự xử lý toàn bộ permission logic
- Return kết quả

---

## 4. Hệ thống mời thành viên

### 4.1. Luồng gửi lời mời

**Chưa được implement hoàn chỉnh trong code hiện tại**. Cần thêm:

```javascript
// Cần thêm vào Group model
static async sendInvitation(groupId, inviteeId, inviterId) {
  return await executeTransaction(async (connection) => {
    // 1. Kiểm tra inviter là admin
    const [adminCheck] = await connection.execute(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, inviterId]
    );
    
    if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
      throw new Error('Only admins can send invitations');
    }
    
    // 2. Kiểm tra invitee chưa là thành viên
    const [memberCheck] = await connection.execute(
      `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, inviteeId]
    );
    
    if (memberCheck.length > 0) {
      throw new Error('User is already a member');
    }
    
    // 3. Tạo invitation
    await connection.execute(
      `INSERT INTO group_invitations (group_id, inviter_id, invitee_id, status)
       VALUES (?, ?, ?, 'pending')`,
      [groupId, inviterId, inviteeId]
    );
    
    return { success: true, message: 'Invitation sent' };
  });
}
```

### 4.2. Luồng chấp nhận lời mời (đã có)

```javascript
// backend/src/routes/invitations.js

router.post('/:invitationId/accept', async (req, res) => {
  const { invitationId } = req.params;
  const userId = req.user.uid;

  // 1. Lấy invitation
  const invitations = await executeQuery(
    `SELECT * FROM group_invitations 
     WHERE id = ? AND invitee_id = ? AND status = 'pending'`,
    [invitationId, userId]
  );

  if (invitations.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Invitation not found or already processed'
    });
  }

  const invitation = invitations[0];

  // 2. Thêm user vào group_members
  await executeQuery(
    `INSERT INTO group_members (group_id, user_id, role, joined_at)
     VALUES (?, ?, 'member', NOW())`,
    [invitation.group_id, userId]
  );

  // 3. Update invitation status
  await executeQuery(
    `UPDATE group_invitations SET status = 'accepted' WHERE id = ?`,
    [invitationId]
  );

  // 4. Sync to Firebase
  await syncGroupMember(invitation.group_id, userId, 'CREATE', { 
    role: 'member' 
  });

  res.json({
    success: true,
    message: 'Joined group successfully'
  });
});
```

---

## 5. Vấn đề và đề xuất cải thiện

### 5.1. Vấn đề hiện tại

#### ❌ **Không phân biệt Owner và Admin**
- Creator và Admin có cùng role = 'admin' trong `group_members`
- Chỉ dựa vào `groups.creator_id` để identify owner
- Không có role 'owner' rõ ràng

**Hậu quả:**
- Admin có thể xóa nhóm (trong code hiện tại)
- Khó mở rộng permissions sau này
- Logic phức tạp khi cần check creator

**Đề xuất:**
```sql
-- Thêm role 'owner' vào ENUM
ALTER TABLE group_members 
  MODIFY `role` ENUM('owner', 'admin', 'member') DEFAULT 'member';

-- Khi tạo nhóm, set role = 'owner' cho creator
INSERT INTO group_members (group_id, user_id, role, joined_at)
VALUES (?, ?, 'owner', NOW())
```

#### ❌ **Không có middleware permission checking**
- Tất cả logic kiểm tra quyền trong Model
- Code lặp lại nhiều lần (adminCheck pattern)
- Khó maintain và test

**Đề xuất:**
```javascript
// middleware/groupPermissions.js
const requireGroupRole = (...allowedRoles) => {
  return async (req, res, next) => {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    const members = await executeQuery(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (members.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this group'
      });
    }
    
    if (!allowedRoles.includes(members[0].role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }
    
    req.userRole = members[0].role;
    next();
  };
};

// Sử dụng:
router.delete('/:groupId/members/:userId', 
  verifyFirebaseToken,
  requireGroupRole('admin', 'owner'),
  removeMemberHandler
);
```

#### ❌ **Logic xóa nhóm cho phép cả admin**
```javascript
// Trong Group.delete()
if (!isCreator && !isAdmin) {
  throw new Error('Only group creator or admin can delete the group');
}
```

**Vấn đề:** Admin có thể xóa nhóm mà không phải creator

**Đề xuất:** Chỉ cho phép creator xóa nhóm
```javascript
if (!isCreator) {
  throw new Error('Only group creator can delete the group');
}
```

#### ❌ **Không có system user search**
- Chưa có API để search users trước khi mời
- Người dùng phải biết trước user ID để mời

**Đề xuất:** Thêm search endpoint
```javascript
// routes/users.js
router.get('/search', verifyFirebaseToken, async (req, res) => {
  const { q, groupId, limit = 20 } = req.query;
  
  // Tìm kiếm user theo tên/email
  // Loại trừ những người đã là thành viên của groupId
  const users = await executeQuery(
    `SELECT u.id, u.email, u.display_name, u.tag
     FROM users u
     WHERE (u.display_name LIKE ? OR u.email LIKE ?)
     AND u.id NOT IN (
       SELECT user_id FROM group_members WHERE group_id = ?
     )
     LIMIT ?`,
    [`%${q}%`, `%${q}%`, groupId, parseInt(limit)]
  );
  
  res.json({ success: true, data: users });
});
```

### 5.2. Đề xuất kiến trúc mới

#### **Option 1: Giữ nguyên 2-role system (đơn giản hơn)**

```sql
-- Role: owner, member
-- Creator tự động là owner, không có admin
-- Chỉ owner có full permissions
```

**Ưu điểm:**
- Đơn giản, rõ ràng
- Phù hợp với nhóm nhỏ
- Ít complexity

**Nhược điểm:**
- Owner phải làm mọi việc
- Không delegate được quyền

#### **Option 2: 3-role system (linh hoạt hơn)**

```sql
-- Role: owner, admin, member  
-- Owner: 1 người, full control
-- Admin: Nhiều người, quản lý members & content
-- Member: Chỉ xem và đóng góp nội dung
```

**Ưu điểm:**
- Phân quyền rõ ràng
- Owner có thể delegate cho admin
- Scalable cho nhóm lớn

**Nhược điểm:**
- Phức tạp hơn
- Cần refactor nhiều code

### 5.3. Ma trận quyền đề xuất (3-role)

| Hành động | Owner | Admin | Member | Viewer |
|-----------|-------|-------|--------|--------|
| **Quản lý nhóm** |
| Xóa nhóm | ✅ | ❌ | ❌ | ❌ |
| Chỉnh sửa thông tin nhóm | ✅ | ✅ | ❌ | ❌ |
| Xem cài đặt nhóm | ✅ | ✅ | ❌ | ❌ |
| Thay đổi cài đặt nhóm | ✅ | ✅ | ❌ | ❌ |
| Chuyển quyền owner | ✅ | ❌ | ❌ | ❌ |
| **Quản lý thành viên** |
| Mời thành viên | ✅ | ✅ | 🔶¹ | ❌ |
| Xóa thành viên | ✅ | ✅² | ❌ | ❌ |
| Thăng cấp thành viên | ✅ | ✅³ | ❌ | ❌ |
| Giáng cấp thành viên | ✅ | 🔶⁴ | ❌ | ❌ |
| Xem danh sách thành viên | ✅ | ✅ | ✅ | ✅ |
| Rời khỏi nhóm | ❌⁵ | ✅ | ✅ | ✅ |
| **Tin nhắn** |
| Gửi tin nhắn | ✅ | ✅ | ✅ | ❌ |
| Xóa tin nhắn của mình | ✅ | ✅ | ✅ | ❌ |
| Xóa tin nhắn của người khác | ✅ | ✅ | ❌ | ❌ |
| Chỉnh sửa tin nhắn | ✅ | ✅ | ✅ | ❌ |
| **Files & Documents** |
| Upload files | ✅ | ✅ | ✅ | ❌ |
| Xóa files của mình | ✅ | ✅ | ✅ | ❌ |
| Xóa files của người khác | ✅ | ✅ | ❌ | ❌ |
| Tải xuống files | ✅ | ✅ | ✅ | ✅ |
| Tạo documents | ✅ | ✅ | ✅ | ❌ |
| Chỉnh sửa documents của mình | ✅ | ✅ | ✅ | ❌ |
| Chỉnh sửa documents của người khác | ✅ | ✅ | ❌ | ❌ |
| **Tags** |
| Tạo tags mới | ✅ | ✅ | 🔶⁶ | ❌ |
| Xóa tags | ✅ | ✅ | ❌ | ❌ |
| Thêm tags cho nội dung | ✅ | ✅ | ✅ | ❌ |
| **Activity Logs** |
| Xem activity logs | ✅ | ✅ | ❌ | ❌ |

**Chú thích:**
- ✅ = Có quyền
- ❌ = Không có quyền
- 🔶 = Có điều kiện

¹ Member có thể mời nếu cài đặt `allowMemberInvite` = true  
² Admin không thể xóa Owner hoặc Admin khác  
³ Admin chỉ có thể thăng Member lên Admin (không thể tạo Owner)  
⁴ Chỉ Owner mới có thể giáng cấp Admin  
⁵ Owner không thể rời nhóm, phải chuyển quyền trước  
⁶ Member có thể tạo tags nếu cài đặt `allowMemberCreateTags` = true

---

## 2. Database Schema

### 2.1. Bảng Groups
```sql
CREATE TABLE groups (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url VARCHAR(500),
  owner_id VARCHAR(255) NOT NULL,
  
  -- Settings
  allow_member_invite BOOLEAN DEFAULT FALSE,
  allow_member_create_tags BOOLEAN DEFAULT FALSE,
  require_approval_for_join BOOLEAN DEFAULT TRUE,
  is_private BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_owner (owner_id)
);
```

### 2.2. Bảng Group Members
```sql
CREATE TABLE group_members (
  id VARCHAR(255) PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, viewer
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_by VARCHAR(255),
  
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  
  UNIQUE KEY unique_member (group_id, user_id),
  INDEX idx_user_groups (user_id),
  INDEX idx_group_members (group_id, role)
);
```

### 2.3. Bảng Permissions (Optional - cho hệ thống mở rộng)
```sql
CREATE TABLE permissions (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50), -- group_management, member_management, content, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ví dụ permissions
INSERT INTO permissions (id, name, description, category) VALUES
('perm_1', 'delete_group', 'Xóa nhóm', 'group_management'),
('perm_2', 'edit_group_info', 'Chỉnh sửa thông tin nhóm', 'group_management'),
('perm_3', 'invite_members', 'Mời thành viên', 'member_management'),
('perm_4', 'remove_members', 'Xóa thành viên', 'member_management'),
('perm_5', 'upload_files', 'Upload files', 'content'),
('perm_6', 'delete_others_files', 'Xóa files của người khác', 'content');
```

### 2.4. Bảng Role Permissions (Optional)
```sql
CREATE TABLE role_permissions (
  role VARCHAR(50) NOT NULL,
  permission_id VARCHAR(255) NOT NULL,
  
  PRIMARY KEY (role, permission_id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Gán quyền cho từng role
-- Owner có tất cả quyền
INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions;

-- Admin có hầu hết quyền trừ delete_group và transfer_ownership
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions 
WHERE name NOT IN ('delete_group', 'transfer_ownership');
```

---

## 3. Kiểm tra quyền (Permission Checking)

### 3.1. Middleware xác thực thành viên nhóm

```javascript
// middleware/groupMembership.js
const checkGroupMembership = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id; // Từ auth middleware
    
    const membership = await GroupMember.findOne({
      where: { group_id: groupId, user_id: userId }
    });
    
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không phải là thành viên của nhóm này'
      });
    }
    
    // Attach membership info to request
    req.groupMembership = membership;
    req.userRole = membership.role;
    next();
  } catch (error) {
    console.error('Group membership check error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
```

### 3.2. Middleware kiểm tra quyền cụ thể

```javascript
// middleware/groupPermissions.js
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.userRole;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền thực hiện hành động này'
      });
    }
    
    next();
  };
};

// Kiểm tra quyền owner
const requireOwner = (req, res, next) => {
  if (req.userRole !== 'owner') {
    return res.status(403).json({
      success: false,
      error: 'Chỉ chủ sở hữu nhóm mới có quyền thực hiện hành động này'
    });
  }
  next();
};

// Kiểm tra quyền admin hoặc owner
const requireAdminOrOwner = requireRole('owner', 'admin');

// Kiểm tra quyền với cài đặt nhóm
const checkGroupSetting = (settingName) => {
  return async (req, res, next) => {
    const { groupId } = req.params;
    
    const group = await Group.findById(groupId);
    
    // Nếu là admin hoặc owner, luôn cho phép
    if (['owner', 'admin'].includes(req.userRole)) {
      return next();
    }
    
    // Kiểm tra cài đặt
    if (!group[settingName]) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền thực hiện hành động này'
      });
    }
    
    next();
  };
};

module.exports = {
  requireRole,
  requireOwner,
  requireAdminOrOwner,
  checkGroupSetting
};
```

### 3.3. Helper functions

```javascript
// utils/permissionHelpers.js

/**
 * Kiểm tra người dùng có quyền trong nhóm không
 */
async function hasPermission(userId, groupId, requiredRole) {
  const membership = await GroupMember.findOne({
    where: { user_id: userId, group_id: groupId }
  });
  
  if (!membership) return false;
  
  const roleHierarchy = {
    owner: 3,
    admin: 2,
    member: 1,
    viewer: 0
  };
  
  const userRoleLevel = roleHierarchy[membership.role] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
  
  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Kiểm tra người dùng có phải owner không
 */
async function isGroupOwner(userId, groupId) {
  const group = await Group.findById(groupId);
  return group && group.owner_id === userId;
}

/**
 * Kiểm tra người dùng có thể xóa thành viên khác không
 */
async function canRemoveMember(removerId, targetId, groupId) {
  const removerMembership = await GroupMember.findOne({
    where: { user_id: removerId, group_id: groupId }
  });
  
  const targetMembership = await GroupMember.findOne({
    where: { user_id: targetId, group_id: groupId }
  });
  
  if (!removerMembership || !targetMembership) return false;
  
  const removerRole = removerMembership.role;
  const targetRole = targetMembership.role;
  
  // Owner có thể xóa bất kỳ ai
  if (removerRole === 'owner') return true;
  
  // Admin có thể xóa member và viewer, nhưng không thể xóa owner hoặc admin khác
  if (removerRole === 'admin') {
    return ['member', 'viewer'].includes(targetRole);
  }
  
  return false;
}

/**
 * Kiểm tra người dùng có thể thay đổi role của thành viên khác không
 */
async function canChangeRole(changerId, targetId, groupId, newRole) {
  const changerMembership = await GroupMember.findOne({
    where: { user_id: changerId, group_id: groupId }
  });
  
  if (!changerMembership) return false;
  
  const changerRole = changerMembership.role;
  
  // Chỉ owner mới có thể chỉ định owner mới
  if (newRole === 'owner') {
    return changerRole === 'owner';
  }
  
  // Owner và admin có thể thăng/giáng cấp member
  if (changerRole === 'owner') return true;
  if (changerRole === 'admin' && newRole !== 'owner') return true;
  
  return false;
}

/**
 * Kiểm tra người dùng có thể xóa nội dung (file, document, message) không
 */
async function canDeleteContent(userId, groupId, ownerId) {
  // Nếu là chủ sở hữu nội dung, luôn có thể xóa
  if (userId === ownerId) return true;
  
  // Kiểm tra role trong nhóm
  const membership = await GroupMember.findOne({
    where: { user_id: userId, group_id: groupId }
  });
  
  if (!membership) return false;
  
  // Admin và owner có thể xóa nội dung của bất kỳ ai
  return ['owner', 'admin'].includes(membership.role);
}

/**
 * Lấy tất cả quyền của một role
 */
function getRolePermissions(role) {
  const permissions = {
    owner: [
      'delete_group',
      'edit_group_info',
      'change_group_settings',
      'transfer_ownership',
      'invite_members',
      'remove_members',
      'change_member_roles',
      'send_messages',
      'delete_any_message',
      'upload_files',
      'delete_any_file',
      'create_documents',
      'edit_any_document',
      'create_tags',
      'delete_tags',
      'view_activity_logs'
    ],
    admin: [
      'edit_group_info',
      'change_group_settings',
      'invite_members',
      'remove_members', // with restrictions
      'change_member_roles', // with restrictions
      'send_messages',
      'delete_any_message',
      'upload_files',
      'delete_any_file',
      'create_documents',
      'edit_any_document',
      'create_tags',
      'delete_tags',
      'view_activity_logs'
    ],
    member: [
      'send_messages',
      'delete_own_message',
      'upload_files',
      'delete_own_file',
      'create_documents',
      'edit_own_document',
      'add_tags',
      'leave_group'
    ],
    viewer: [
      'view_content',
      'download_files',
      'leave_group'
    ]
  };
  
  return permissions[role] || [];
}

module.exports = {
  hasPermission,
  isGroupOwner,
  canRemoveMember,
  canChangeRole,
  canDeleteContent,
  getRolePermissions
};
```

---

## 4. Ứng dụng trong Routes

### 4.1. Routes quản lý nhóm

```javascript
// routes/groups.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { checkGroupMembership } = require('../middleware/groupMembership');
const { requireOwner, requireAdminOrOwner } = require('../middleware/groupPermissions');

// Tạo nhóm mới - Chỉ cần đăng nhập
router.post('/', authenticate, createGroup);

// Xem thông tin nhóm - Phải là thành viên
router.get('/:groupId', authenticate, checkGroupMembership, getGroupInfo);

// Chỉnh sửa thông tin nhóm - Admin hoặc Owner
router.put('/:groupId', 
  authenticate, 
  checkGroupMembership, 
  requireAdminOrOwner,
  updateGroupInfo
);

// Xóa nhóm - Chỉ Owner
router.delete('/:groupId',
  authenticate,
  checkGroupMembership,
  requireOwner,
  deleteGroup
);

// Chuyển quyền owner - Chỉ Owner
router.post('/:groupId/transfer-ownership',
  authenticate,
  checkGroupMembership,
  requireOwner,
  transferOwnership
);
```

### 4.2. Routes quản lý thành viên

```javascript
// routes/members.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { checkGroupMembership } = require('../middleware/groupMembership');
const { 
  requireAdminOrOwner, 
  checkGroupSetting 
} = require('../middleware/groupPermissions');

// Xem danh sách thành viên - Mọi thành viên
router.get('/:groupId/members',
  authenticate,
  checkGroupMembership,
  getGroupMembers
);

// Mời thành viên - Admin/Owner hoặc Member (nếu được phép)
router.post('/:groupId/members/invite',
  authenticate,
  checkGroupMembership,
  checkGroupSetting('allow_member_invite'),
  inviteMember
);

// Xóa thành viên - Admin/Owner (với ràng buộc)
router.delete('/:groupId/members/:userId',
  authenticate,
  checkGroupMembership,
  requireAdminOrOwner,
  removeMember
);

// Thay đổi role - Admin/Owner (với ràng buộc)
router.patch('/:groupId/members/:userId/role',
  authenticate,
  checkGroupMembership,
  requireAdminOrOwner,
  changeMemberRole
);

// Rời khỏi nhóm - Bản thân (trừ owner)
router.post('/:groupId/leave',
  authenticate,
  checkGroupMembership,
  leaveGroup
);
```

### 4.3. Routes quản lý nội dung

```javascript
// routes/groupContent.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { checkGroupMembership } = require('../middleware/groupMembership');
const { requireRole } = require('../middleware/groupPermissions');

// Upload file - Member trở lên
router.post('/:groupId/files',
  authenticate,
  checkGroupMembership,
  requireRole('member', 'admin', 'owner'),
  uploadFile
);

// Xóa file - Chủ sở hữu file hoặc Admin/Owner
router.delete('/:groupId/files/:fileId',
  authenticate,
  checkGroupMembership,
  deleteFile // Logic kiểm tra ownership trong controller
);

// Gửi tin nhắn - Member trở lên
router.post('/:groupId/messages',
  authenticate,
  checkGroupMembership,
  requireRole('member', 'admin', 'owner'),
  sendMessage
);

// Xóa tin nhắn - Chủ tin nhắn hoặc Admin/Owner
router.delete('/:groupId/messages/:messageId',
  authenticate,
  checkGroupMembership,
  deleteMessage // Logic kiểm tra ownership trong controller
);
```

---

## 5. Ứng dụng trong Controllers

### 5.1. Controller xóa thành viên

```javascript
// controllers/memberController.js
const { canRemoveMember } = require('../utils/permissionHelpers');

async function removeMember(req, res) {
  try {
    const { groupId, userId } = req.params;
    const removerId = req.user.id;
    
    // Kiểm tra không thể tự xóa mình
    if (removerId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Không thể tự xóa mình. Hãy sử dụng chức năng "Rời nhóm"'
      });
    }
    
    // Kiểm tra quyền xóa
    const canRemove = await canRemoveMember(removerId, userId, groupId);
    
    if (!canRemove) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xóa thành viên này'
      });
    }
    
    // Xóa thành viên
    await GroupMember.destroy({
      where: { group_id: groupId, user_id: userId }
    });
    
    // Log activity
    await ActivityLog.create({
      group_id: groupId,
      user_id: removerId,
      action: 'member_removed',
      target_user_id: userId,
      details: `Đã xóa thành viên`
    });
    
    // Thông báo cho người bị xóa
    await sendNotification(userId, {
      type: 'removed_from_group',
      groupId
    });
    
    res.json({
      success: true,
      message: 'Đã xóa thành viên khỏi nhóm'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
```

### 5.2. Controller thay đổi role

```javascript
// controllers/memberController.js
const { canChangeRole } = require('../utils/permissionHelpers');

async function changeMemberRole(req, res) {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;
    const changerId = req.user.id;
    
    // Validate role
    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role không hợp lệ'
      });
    }
    
    // Không thể tự thay đổi role của mình
    if (changerId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Không thể tự thay đổi role của mình'
      });
    }
    
    // Kiểm tra quyền
    const canChange = await canChangeRole(changerId, userId, groupId, role);
    
    if (!canChange) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền thay đổi role này'
      });
    }
    
    // Nếu chuyển thành owner, cần chuyển owner hiện tại thành admin
    if (role === 'owner') {
      const group = await Group.findById(groupId);
      
      // Cập nhật owner cũ thành admin
      await GroupMember.update(
        { role: 'admin' },
        { where: { group_id: groupId, user_id: group.owner_id } }
      );
      
      // Cập nhật owner mới trong bảng groups
      await group.update({ owner_id: userId });
    }
    
    // Cập nhật role
    await GroupMember.update(
      { role },
      { where: { group_id: groupId, user_id: userId } }
    );
    
    // Log activity
    await ActivityLog.create({
      group_id: groupId,
      user_id: changerId,
      action: 'role_changed',
      target_user_id: userId,
      details: `Đã thay đổi role thành ${role}`
    });
    
    // Thông báo
    await sendNotification(userId, {
      type: 'role_changed',
      groupId,
      newRole: role
    });
    
    res.json({
      success: true,
      message: 'Đã thay đổi role thành công',
      data: { role }
    });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
```

### 5.3. Controller xóa file

```javascript
// controllers/fileController.js
const { canDeleteContent } = require('../utils/permissionHelpers');

async function deleteFile(req, res) {
  try {
    const { groupId, fileId } = req.params;
    const userId = req.user.id;
    
    // Lấy thông tin file
    const file = await File.findOne({
      where: { id: fileId, group_id: groupId }
    });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File không tồn tại'
      });
    }
    
    // Kiểm tra quyền xóa
    const canDelete = await canDeleteContent(userId, groupId, file.uploaded_by);
    
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xóa file này'
      });
    }
    
    // Xóa file khỏi storage (Cloudinary)
    if (file.cloudinary_public_id) {
      await cloudinary.uploader.destroy(file.cloudinary_public_id);
    }
    
    // Xóa record khỏi database
    await file.destroy();
    
    // Log activity
    await ActivityLog.create({
      group_id: groupId,
      user_id: userId,
      action: 'file_deleted',
      details: `Đã xóa file: ${file.original_name}`
    });
    
    res.json({
      success: true,
      message: 'Đã xóa file thành công'
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
```

---

## 6. Frontend Implementation

### 6.1. Permission Context

```jsx
// contexts/PermissionContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { user } = useAuth();
  const [groupPermissions, setGroupPermissions] = useState({});
  
  // Lấy quyền của user trong một nhóm cụ thể
  const getUserRoleInGroup = (groupId) => {
    return groupPermissions[groupId]?.role || null;
  };
  
  // Kiểm tra quyền cụ thể
  const hasPermission = (groupId, permission) => {
    const role = getUserRoleInGroup(groupId);
    if (!role) return false;
    
    const rolePermissions = getRolePermissions(role);
    return rolePermissions.includes(permission);
  };
  
  // Kiểm tra role
  const hasRole = (groupId, ...roles) => {
    const role = getUserRoleInGroup(groupId);
    return roles.includes(role);
  };
  
  const isOwner = (groupId) => hasRole(groupId, 'owner');
  const isAdmin = (groupId) => hasRole(groupId, 'admin');
  const isAdminOrOwner = (groupId) => hasRole(groupId, 'admin', 'owner');
  const isMember = (groupId) => hasRole(groupId, 'member', 'admin', 'owner');
  
  // Load quyền khi vào nhóm
  const loadGroupPermissions = async (groupId) => {
    try {
      const response = await api.get(`/groups/${groupId}/my-role`);
      setGroupPermissions(prev => ({
        ...prev,
        [groupId]: response.data
      }));
    } catch (error) {
      console.error('Load permissions error:', error);
    }
  };
  
  const value = {
    getUserRoleInGroup,
    hasPermission,
    hasRole,
    isOwner,
    isAdmin,
    isAdminOrOwner,
    isMember,
    loadGroupPermissions
  };
  
  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

// Helper function
function getRolePermissions(role) {
  const permissions = {
    owner: [
      'delete_group', 'edit_group', 'invite_members', 'remove_members',
      'change_roles', 'delete_any_message', 'delete_any_file', 'manage_tags'
    ],
    admin: [
      'edit_group', 'invite_members', 'remove_members', 'change_roles',
      'delete_any_message', 'delete_any_file', 'manage_tags'
    ],
    member: [
      'send_messages', 'upload_files', 'create_documents'
    ],
    viewer: []
  };
  
  return permissions[role] || [];
}
```

### 6.2. Conditional Rendering Components

```jsx
// components/PermissionGate.jsx
import { usePermissions } from '../contexts/PermissionContext';

export const PermissionGate = ({ groupId, permission, children, fallback = null }) => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(groupId, permission)) {
    return fallback;
  }
  
  return <>{children}</>;
};

export const RoleGate = ({ groupId, roles, children, fallback = null }) => {
  const { hasRole } = usePermissions();
  
  if (!hasRole(groupId, ...roles)) {
    return fallback;
  }
  
  return <>{children}</>;
};

// Hook tùy chỉnh
export const useRoleCheck = (groupId) => {
  const { isOwner, isAdmin, isAdminOrOwner, isMember } = usePermissions();
  
  return {
    isOwner: isOwner(groupId),
    isAdmin: isAdmin(groupId),
    isAdminOrOwner: isAdminOrOwner(groupId),
    isMember: isMember(groupId)
  };
};
```

### 6.3. Ứng dụng trong UI

```jsx
// components/GroupSettings.jsx
import { PermissionGate, RoleGate, useRoleCheck } from './PermissionGate';

const GroupSettings = ({ group }) => {
  const { isOwner, isAdminOrOwner } = useRoleCheck(group.id);
  
  return (
    <div className="group-settings">
      {/* Chỉ admin và owner thấy */}
      <RoleGate groupId={group.id} roles={['admin', 'owner']}>
        <section>
          <h3>Cài đặt nhóm</h3>
          <SettingsForm group={group} />
        </section>
      </RoleGate>
      
      {/* Chỉ owner thấy */}
      <RoleGate groupId={group.id} roles={['owner']}>
        <section>
          <h3>Chuyển quyền sở hữu</h3>
          <TransferOwnershipForm group={group} />
        </section>
      </RoleGate>
      
      {/* Chỉ owner thấy */}
      {isOwner && (
        <section>
          <h3>Vùng nguy hiểm</h3>
          <button onClick={handleDeleteGroup}>Xóa nhóm</button>
        </section>
      )}
    </div>
  );
};
```

```jsx
// components/MemberList.jsx
import { usePermissions } from '../contexts/PermissionContext';

const MemberItem = ({ member, groupId, currentUserId }) => {
  const { isAdminOrOwner, isOwner } = useRoleCheck(groupId);
  const canRemove = isAdminOrOwner && member.id !== currentUserId;
  const canChangeRole = isAdminOrOwner && member.id !== currentUserId;
  
  return (
    <div className="member-item">
      <Avatar src={member.photoURL} />
      <div className="member-info">
        <span className="name">{member.displayName}</span>
        <span className="role">{getRoleLabel(member.role)}</span>
      </div>
      
      <div className="actions">
        {/* Chỉ hiển thị nút cho người có quyền */}
        {canChangeRole && member.role !== 'owner' && (
          <RoleDropdown 
            currentRole={member.role}
            onChange={(newRole) => handleChangeRole(member.id, newRole)}
            canSetOwner={isOwner}
          />
        )}
        
        {canRemove && member.role !== 'owner' && (
          <button onClick={() => handleRemoveMember(member.id)}>
            Xóa
          </button>
        )}
      </div>
    </div>
  );
};

function getRoleLabel(role) {
  const labels = {
    owner: 'Chủ sở hữu',
    admin: 'Quản trị viên',
    member: 'Thành viên',
    viewer: 'Người xem'
  };
  return labels[role] || role;
}
```

```jsx
// components/FileItem.jsx
const FileItem = ({ file, groupId, currentUserId }) => {
  const { isAdminOrOwner } = useRoleCheck(groupId);
  const canDelete = file.uploadedBy === currentUserId || isAdminOrOwner;
  
  return (
    <div className="file-item">
      <FileIcon type={file.type} />
      <span className="filename">{file.name}</span>
      
      <div className="actions">
        <button onClick={() => handleDownload(file.id)}>
          Tải xuống
        </button>
        
        {canDelete && (
          <button onClick={() => handleDelete(file.id)}>
            Xóa
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## 7. Best Practices

### 7.1. Security
- ✅ Luôn kiểm tra quyền ở cả frontend và backend
- ✅ Backend là lớp bảo mật chính, frontend chỉ để UX
- ✅ Không tin tưởng dữ liệu từ client
- ✅ Log tất cả các hành động liên quan đến quyền
- ✅ Validate input kỹ lưỡng

### 7.2. Performance
- ✅ Cache role/permission của user
- ✅ Sử dụng index cho database queries
- ✅ Tránh N+1 queries khi load danh sách thành viên
- ✅ Prefetch permissions khi user vào nhóm

### 7.3. User Experience
- ✅ Ẩn các tùy chọn người dùng không có quyền
- ✅ Hiển thị thông báo lỗi rõ ràng khi thiếu quyền
- ✅ Disable buttons thay vì ẩn hoàn toàn (tùy trường hợp)
- ✅ Hiển thị badge/icon cho roles khác nhau

### 7.4. Maintainability
- ✅ Tập trung logic permission vào helper functions
- ✅ Sử dụng middleware cho routes
- ✅ Đặt tên permission rõ ràng và có ý nghĩa
- ✅ Document các quyền và ràng buộc

---

## 8. Testing

### 8.1. Unit Tests

```javascript
// tests/permissions.test.js
describe('Permission Helpers', () => {
  describe('canRemoveMember', () => {
    it('owner có thể xóa bất kỳ ai', async () => {
      const result = await canRemoveMember('owner_id', 'member_id', 'group_id');
      expect(result).toBe(true);
    });
    
    it('admin không thể xóa owner', async () => {
      const result = await canRemoveMember('admin_id', 'owner_id', 'group_id');
      expect(result).toBe(false);
    });
    
    it('admin không thể xóa admin khác', async () => {
      const result = await canRemoveMember('admin_id', 'admin2_id', 'group_id');
      expect(result).toBe(false);
    });
    
    it('admin có thể xóa member', async () => {
      const result = await canRemoveMember('admin_id', 'member_id', 'group_id');
      expect(result).toBe(true);
    });
    
    it('member không thể xóa ai', async () => {
      const result = await canRemoveMember('member_id', 'member2_id', 'group_id');
      expect(result).toBe(false);
    });
  });
});
```

### 8.2. Integration Tests

```javascript
// tests/api/members.test.js
describe('DELETE /api/groups/:groupId/members/:userId', () => {
  it('owner có thể xóa member', async () => {
    const response = await request(app)
      .delete(`/api/groups/${groupId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(200);
  });
  
  it('admin không thể xóa owner', async () => {
    const response = await request(app)
      .delete(`/api/groups/${groupId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(response.status).toBe(403);
  });
  
  it('member không thể xóa ai', async () => {
    const response = await request(app)
      .delete(`/api/groups/${groupId}/members/${member2Id}`)
      .set('Authorization', `Bearer ${memberToken}`);
    
    expect(response.status).toBe(403);
  });
});
```

---

## 9. Troubleshooting

### 9.1. Các vấn đề thường gặp

#### Vấn đề: User không có quyền dù là admin
**Nguyên nhân:** Role trong database không đúng hoặc cache cũ

**Giải pháp:**
```sql
-- Kiểm tra role trong database
SELECT * FROM group_members 
WHERE user_id = 'user_id' AND group_id = 'group_id';

-- Cập nhật role nếu cần
UPDATE group_members 
SET role = 'admin' 
WHERE user_id = 'user_id' AND group_id = 'group_id';
```

#### Vấn đề: Không thể xóa thành viên
**Nguyên nhân:** Logic kiểm tra quyền không chính xác

**Giải pháp:**
- Kiểm tra role của cả người xóa và người bị xóa
- Đảm bảo admin không thể xóa owner hoặc admin khác
- Log chi tiết để debug

#### Vấn đề: Frontend hiển thị nút nhưng API báo lỗi 403
**Nguyên nhân:** Frontend và backend không đồng bộ logic permission

**Giải pháp:**
- Đảm bảo logic kiểm tra quyền giống nhau ở cả 2 phía
- Tạo shared permission constants
- Fetch role từ API thay vì hardcode

---

## 10. Roadmap & Future Enhancements

### 10.1. Custom Permissions
- Cho phép tạo custom roles với permissions tùy chỉnh
- Permission templates cho các loại nhóm khác nhau

### 10.2. Fine-grained Permissions
- Permissions theo từng tài nguyên cụ thể (file, folder, document)
- Temporary permissions (cấp quyền tạm thời)

### 10.3. Permission Audit
- Dashboard hiển thị ai có quyền gì
- History của các thay đổi permission
- Alert khi có thay đổi quan trọng

### 10.4. Advanced Features
- Bulk permission changes
- Permission inheritance
- Permission groups/teams trong nhóm lớn

---

## 11. Tóm tắt

Hệ thống phân quyền trong nhóm bao gồm:

1. **4 Roles chính:** Owner, Admin, Member, Viewer
2. **Hierarchy rõ ràng:** Owner > Admin > Member > Viewer
3. **Permission checking:** Ở cả backend (bảo mật) và frontend (UX)
4. **Middleware system:** Tái sử dụng và dễ maintain
5. **Helper functions:** Tập trung logic phức tạp
6. **Frontend context:** Quản lý state và UI conditional
7. **Security first:** Luôn validate ở backend
8. **Logging:** Track tất cả các hành động quan trọng

Hệ thống này đảm bảo:
- ✅ Bảo mật chặt chẽ
- ✅ Dễ mở rộng
- ✅ Dễ maintain
- ✅ User experience tốt
- ✅ Testable
