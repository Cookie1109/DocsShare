-- Xóa cột avatar_url và group_photo_url vì chỉ lưu trong Firebase
ALTER TABLE users DROP COLUMN avatar_url;
ALTER TABLE `groups` DROP COLUMN group_photo_url;
