-- Xóa hết hình ảnh trong MySQL vì chỉ lưu trong Firebase
UPDATE users SET avatar_url = NULL;
UPDATE `groups` SET group_photo_url = NULL;

-- Đổi column thành VARCHAR ngắn
ALTER TABLE users MODIFY COLUMN avatar_url VARCHAR(255) NULL COMMENT 'Stored in Firebase only';
ALTER TABLE `groups` MODIFY COLUMN group_photo_url VARCHAR(255) NULL COMMENT 'Stored in Firebase only';
