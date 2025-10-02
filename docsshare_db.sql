-- =================================================================
-- SCHEMA HOÀN CHỈNH CHO DỰ ÁN CHIA SẺ TÀI LIỆU
-- Người tạo: Gemini Expert & Bạn
-- Phiên bản: 1.0 (Bao gồm hệ thống tag cục bộ)
-- =================================================================

-- -----------------------------------------------------------------
-- Bảng `users`: Nguồn dữ liệu chính cho thông tin người dùng.
-- -----------------------------------------------------------------
CREATE TABLE users (
    -- Dùng VARCHAR để lưu UID từ Firebase Authentication, là khóa liên kết chính.
    id VARCHAR(128) PRIMARY KEY,
    
    -- Email là duy nhất và bắt buộc, dùng để định danh và liên lạc.
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- Tên hiển thị của người dùng (phần trước dấu #).
    display_name VARCHAR(100) NOT NULL,
    
    -- Tag 4-6 số của người dùng (phần sau dấu #).
    `tag` VARCHAR(10) NOT NULL,
    
    avatar_url VARCHAR(2048),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,

    -- Ràng buộc quan trọng: Đảm bảo không có 2 người dùng nào trùng cả Name và Tag.
    -- Đây là business logic chính cho hệ thống định danh người dùng.
    UNIQUE KEY `unique_name_tag` (`display_name`, `tag`)
);

-- -----------------------------------------------------------------
-- Bảng `groups`: Lưu thông tin chi tiết của các nhóm.
-- -----------------------------------------------------------------
CREATE TABLE `groups` (
    -- Dùng số nguyên tự tăng làm khóa chính để các thao tác join nội bộ hiệu quả hơn.
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_photo_url VARCHAR(2048),
    creator_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ràng buộc khóa ngoại đến người tạo nhóm.
    -- ON DELETE RESTRICT: Ngăn không cho xóa một user nếu họ đã tạo một nhóm nào đó.
    -- Điều này giúp tránh tình trạng nhóm "mồ côi" không có người tạo.
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `group_members`: Bảng trung gian cho quan hệ Nhiều-Nhiều giữa Users và Groups.
-- -----------------------------------------------------------------
CREATE TABLE group_members (
    group_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    `role` ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Khóa chính phức hợp: Đảm bảo một người dùng chỉ có thể tham gia một nhóm một lần duy nhất.
    PRIMARY KEY (group_id, user_id),
    
    -- ON DELETE CASCADE: Nếu một nhóm bị xóa, tất cả các bản ghi thành viên của nhóm đó sẽ tự động bị xóa theo.
    -- Tương tự, nếu một user bị xóa, họ cũng sẽ tự động rời khỏi tất cả các nhóm.
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `group_mapping`: Ánh xạ giữa Firestore Group IDs và MySQL Group IDs.
-- Cần thiết cho việc tích hợp frontend (sử dụng Firestore) với backend (sử dụng MySQL).
-- -----------------------------------------------------------------
CREATE TABLE group_mapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    -- Firestore Group ID (chuỗi ký tự)
    firestore_id VARCHAR(128) UNIQUE NOT NULL,
    -- MySQL Group ID (số nguyên)
    mysql_id INT NOT NULL,
    -- Tên nhóm để debug và quản lý
    group_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ràng buộc khóa ngoại đến bảng groups
    FOREIGN KEY (mysql_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Index để tối ưu tìm kiếm theo Firestore ID
    INDEX idx_firestore_id (firestore_id),
    INDEX idx_mysql_id (mysql_id)
);

-- -----------------------------------------------------------------
-- Bảng `files`: Lưu trữ metadata của tất cả các file.
-- -----------------------------------------------------------------
CREATE TABLE files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    -- URL Cloudinary của file được upload.
    storage_path VARCHAR(1024) NOT NULL,
    -- Public ID của file trong Cloudinary để quản lý và xóa.
    cloudinary_public_id VARCHAR(512),
    mime_type VARCHAR(100),
    -- Dùng BIGINT để hỗ trợ các file có dung lượng rất lớn.
    size_bytes BIGINT NOT NULL,
    group_id INT NOT NULL,
    uploader_id VARCHAR(128) NOT NULL,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Nếu một nhóm bị xóa, tất cả file trong đó cũng sẽ bị xóa theo.
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    -- Ngăn không cho xóa user nếu họ đã từng upload file, để giữ lại lịch sử.
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `tags`: Quản lý các tag. Được thiết kế theo mô hình "cục bộ" theo nhóm.
-- -----------------------------------------------------------------
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    -- Cột này xác định tag này thuộc về nhóm nào.
    group_id INT NOT NULL,
    creator_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ràng buộc UNIQUE phức hợp: Cho phép các nhóm khác nhau có tag trùng tên,
    -- nhưng trong CÙNG một nhóm, mỗi tên tag là duy nhất.
    UNIQUE KEY `unique_tag_in_group` (`name`, `group_id`),

    -- Nếu một nhóm bị xóa, tất cả tag của nhóm đó cũng sẽ bị xóa theo.
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `file_tags`: Bảng trung gian cho quan hệ Nhiều-Nhiều giữa Files và Tags.
-- -----------------------------------------------------------------
CREATE TABLE file_tags (
    file_id INT NOT NULL,
    tag_id INT NOT NULL,
    -- Khóa chính phức hợp: Ngăn một file bị gắn cùng một tag nhiều lần.
    PRIMARY KEY (file_id, tag_id),
    -- Nếu file hoặc tag bị xóa, liên kết này cũng sẽ tự động bị xóa.
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `activity_logs`: Ghi lại lịch sử hoạt động để kiểm tra và phân tích.
-- -----------------------------------------------------------------
CREATE TABLE activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    action_type ENUM('upload', 'download', 'delete_file', 'create_group', 'join_group', 'create_tag') NOT NULL,
    target_id VARCHAR(255),
    -- Dùng JSON để lưu các thông tin phụ trợ một cách linh hoạt.
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- =================================================================
-- INDEXES: Tối ưu hóa hiệu năng truy vấn.
-- =================================================================
-- Tăng tốc tìm kiếm tất cả các nhóm mà một người dùng tham gia.
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
-- Tăng tốc liệt kê tất cả các file trong một nhóm.
CREATE INDEX idx_files_group_id ON files(group_id);
-- Tăng tốc tìm kiếm tất cả các file mà một người dùng đã upload.
CREATE INDEX idx_files_uploader_id ON files(uploader_id);