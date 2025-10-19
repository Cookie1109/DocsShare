# Feature: Thêm thành viên vào nhóm

## 📋 Overview
Cho phép người dùng thêm thành viên mới vào nhóm bằng cách search Name#Tag, gửi lời mời, và người được mời có thể chấp nhận/từ chối.

## 🎯 Features
1. **Search Users**: Tìm người dùng bằng Name#Tag
2. **Send Invitation**: Gửi lời mời tham gia nhóm
3. **Notification**: Thông báo cho người được mời
4. **Accept/Decline**: Người được mời có thể chấp nhận hoặc từ chối
5. **System Message**: Hiển thị "X đã tham gia nhóm" trong chat

## 🗄️ Database Schema

### Table: `group_invitations`
```sql
CREATE TABLE group_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  inviter_id VARCHAR(255) NOT NULL,
  invitee_id VARCHAR(255) NOT NULL,
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  UNIQUE KEY unique_invitation (group_id, invitee_id, status)
);
```

## 🔌 API Endpoints

### 1. Search Users
```
GET /api/users/search?q=NhanTrong#1234
Response: {
  success: true,
  users: [{
    uid: "abc123",
    displayName: "Nhân Trọng",
    email: "nhantrong@gmail.com",
    userTag: "NhanTrong#1234",
    avatar: null,
    isInGroup: false
  }]
}
```

### 2. Send Invitation
```
POST /api/groups/:groupId/invitations
Body: {
  userIds: ["uid1", "uid2"]
}
Response: {
  success: true,
  invitationsSent: 2
}
```

### 3. Get My Invitations
```
GET /api/invitations/me
Response: {
  success: true,
  invitations: [{
    id: 1,
    group: {
      id: 3,
      name: "React Team",
      firestoreId: "abc123"
    },
    inviter: {
      displayName: "Nhân Trọng",
      email: "nhantrong@gmail.com"
    },
    createdAt: "2025-10-19T10:00:00Z"
  }]
}
```

### 4. Accept/Decline Invitation
```
POST /api/invitations/:invitationId/accept
POST /api/invitations/:invitationId/decline
Response: {
  success: true,
  message: "Đã tham gia nhóm"
}
```

## 🎨 UI Components

### 1. AddMemberModal
- Search input với debounce
- Results list với avatar
- Multi-select
- Send invitation button

### 2. InvitationNotification
- Badge/icon trên header
- Dropdown list invitations
- Accept/Decline buttons inline

### 3. System Message
- Special message type "system"
- Centered text
- Gray color
- Format: "Nhân Trọng đã tham gia nhóm"

## 📝 TODO Checklist

### Backend:
- [ ] Create migration for group_invitations table
- [ ] API: Search users
- [ ] API: Send invitations
- [ ] API: Get my invitations
- [ ] API: Accept invitation
- [ ] API: Decline invitation
- [ ] Add user to group after accept
- [ ] Create system message in Firestore

### Frontend:
- [ ] AddMemberModal component
- [ ] InvitationNotification component
- [ ] System message display in chat
- [ ] Update GroupSidebar with "Add member" button
- [ ] API service methods
- [ ] Toast notifications

### Testing:
- [ ] Test search users
- [ ] Test send invitations
- [ ] Test accept/decline
- [ ] Test system messages
- [ ] Test edge cases (already in group, etc.)

## 🎯 Implementation Order
1. Database schema ✅
2. Backend API routes
3. Frontend services
4. UI components
5. Integration & testing
