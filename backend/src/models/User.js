// Mock database cho User model
// Sẽ được thay thế bằng Firebase Firestore sau này

class User {
  constructor() {
    this.users = [
      {
        id: '1',
        name: 'Người dùng Demo',
        email: 'demo@docsshare.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaQa', // hashed 'demo123'
        role: 'member',
        avatar: null,
        joinDate: '2025-01-01T00:00:00Z',
        isActive: true,
        documentsUploaded: 5,
        documentsDownloaded: 15
      },
      {
        id: '2',
        name: 'Admin DocsShare',
        email: 'admin@docsshare.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaQa', // hashed 'admin123'
        role: 'admin',
        avatar: null,
        joinDate: '2024-12-01T00:00:00Z',
        isActive: true,
        documentsUploaded: 0,
        documentsDownloaded: 0
      }
    ];
  }

  // Tìm user theo email
  async findByEmail(email) {
    return this.users.find(user => user.email === email);
  }

  // Tìm user theo ID
  async findById(id) {
    return this.users.find(user => user.id === id);
  }

  // Tạo user mới
  async create(userData) {
    const newUser = {
      id: Date.now().toString(),
      ...userData,
      joinDate: new Date().toISOString(),
      isActive: true,
      documentsUploaded: 0,
      documentsDownloaded: 0
    };
    
    this.users.push(newUser);
    return newUser;
  }

  // Cập nhật user
  async update(id, updateData) {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;
    
    this.users[userIndex] = { ...this.users[userIndex], ...updateData };
    return this.users[userIndex];
  }

  // Xóa user
  async delete(id) {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return false;
    
    this.users.splice(userIndex, 1);
    return true;
  }

  // Lấy tất cả users (cho admin)
  async getAll() {
    return this.users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  // Thống kê users
  async getStats() {
    return {
      total: this.users.length,
      active: this.users.filter(user => user.isActive).length,
      admins: this.users.filter(user => user.role === 'admin').length,
      members: this.users.filter(user => user.role === 'member').length
    };
  }
}

module.exports = new User();
