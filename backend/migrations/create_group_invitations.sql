-- Migration: Create group_invitations table
-- Date: 2025-10-19

CREATE TABLE IF NOT EXISTS group_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  inviter_id VARCHAR(255) NOT NULL COMMENT 'Firebase UID of person who sent invitation',
  invitee_id VARCHAR(255) NOT NULL COMMENT 'Firebase UID of person being invited',
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  
  -- Prevent duplicate pending invitations
  UNIQUE KEY unique_pending_invitation (group_id, invitee_id, status),
  
  INDEX idx_invitee (invitee_id, status),
  INDEX idx_group (group_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comments
ALTER TABLE group_invitations 
  COMMENT = 'Stores group invitations and their status';
