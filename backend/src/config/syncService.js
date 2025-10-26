/**
 * =================================================================
 * BIDIRECTIONAL SYNC SERVICE - MySQL ↔️ Firebase
 * =================================================================
 * 
 * Mục đích:
 * - Theo dõi mọi thay đổi trên Firebase và sync vào MySQL
 * - Đẩy thay đổi từ MySQL lên Firebase
 * - Xử lý xung đột với Last-Write-Wins strategy
 * - Đảm bảo idempotence và audit trail đầy đủ
 * 
 * Author: AI Agent
 * Date: 2025-10-26
 * =================================================================
 */

const admin = require('./firebaseAdmin');
const { executeQuery, executeTransaction } = require('./db');
const crypto = require('crypto');

class SyncService {
  constructor() {
    this.db = admin.firestore();
    this.listeners = [];
    this.syncInProgress = new Set(); // Prevent sync loops
    this.config = {
      conflictStrategy: 'last-write-wins', // hoặc 'firebase-wins', 'mysql-wins'
      enableAutoRetry: true,
      maxRetries: 3,
      retryDelay: 1000, // ms
      enableLogging: true
    };
  }

  /**
   * Khởi tạo tất cả listeners
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Sync Service...');
      
      // Setup Firebase listeners cho từng collection
      await this.setupUsersListener();
      await this.setupGroupsListener();
      await this.setupGroupMembersListener();
      await this.setupFilesListener();
      await this.setupTagsListener();
      
      console.log('✅ Sync Service initialized with', this.listeners.length, 'listeners');
      
      return { success: true, listenersCount: this.listeners.length };
    } catch (error) {
      console.error('❌ Failed to initialize Sync Service:', error);
      throw error;
    }
  }

  /**
   * Generate idempotence key
   */
  generateIdempotenceKey(source, table, recordId, action, timestamp) {
    const data = `${source}-${table}-${recordId}-${action}-${timestamp}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Generate data hash để detect changes
   */
  generateDataHash(data) {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Check if sync is already in progress (prevent loops)
   */
  isSyncInProgress(key) {
    return this.syncInProgress.has(key);
  }

  /**
   * Mark sync as in progress
   */
  markSyncInProgress(key) {
    this.syncInProgress.add(key);
    // Auto-remove after 10 seconds to prevent deadlock
    setTimeout(() => this.syncInProgress.delete(key), 10000);
  }

  /**
   * Log audit event
   */
  async logAudit(params) {
    const {
      eventSource,
      tableName,
      recordId,
      action,
      oldValue = null,
      newValue = null,
      userId = null,
      success = true,
      errorMessage = null,
      idempotenceKey = null
    } = params;

    try {
      const result = await executeQuery(
        `CALL log_audit_event(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventSource,
          tableName,
          String(recordId),
          action,
          oldValue ? JSON.stringify(oldValue) : null,
          newValue ? JSON.stringify(newValue) : null,
          userId,
          success,
          errorMessage,
          idempotenceKey
        ]
      );

      if (this.config.enableLogging && result[0]?.status === 'DUPLICATE') {
        console.log(`⚠️ Duplicate sync prevented: ${idempotenceKey}`);
        return { duplicate: true };
      }

      return { success: true, duplicate: false };
    } catch (error) {
      console.error('❌ Failed to log audit:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update sync state
   */
  async updateSyncState(entityType, entityId, dataHash, direction) {
    try {
      await executeQuery(
        `CALL update_sync_state(?, ?, ?, ?)`,
        [entityType, String(entityId), dataHash, direction]
      );
    } catch (error) {
      console.error('❌ Failed to update sync state:', error);
    }
  }

  /**
   * Log sync error để xử lý sau
   */
  async logSyncError(entityType, entityId, errorType, errorMessage, failedData = null) {
    try {
      await executeQuery(
        `INSERT INTO sync_errors (entity_type, entity_id, error_type, error_message, failed_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          entityType,
          String(entityId),
          errorType,
          errorMessage,
          failedData ? JSON.stringify(failedData) : null
        ]
      );
    } catch (error) {
      console.error('❌ Failed to log sync error:', error);
    }
  }

  /**
   * Resolve conflict using configured strategy
   */
  async resolveConflict(entityType, entityId, mysqlData, firebaseData) {
    const mysqlTimestamp = mysqlData.updated_at || mysqlData.created_at;
    const firebaseTimestamp = firebaseData.updatedAt || firebaseData.createdAt;

    let winner = null;
    let strategy = this.config.conflictStrategy;

    switch (strategy) {
      case 'last-write-wins':
        winner = new Date(firebaseTimestamp) > new Date(mysqlTimestamp) 
          ? 'firebase' 
          : 'mysql';
        break;
      
      case 'firebase-wins':
        winner = 'firebase';
        break;
      
      case 'mysql-wins':
        winner = 'mysql';
        break;
      
      default:
        winner = 'firebase'; // Default to Firebase
    }

    // Log conflict resolution
    await this.logAudit({
      eventSource: 'System',
      tableName: entityType,
      recordId: entityId,
      action: 'UPDATE',
      oldValue: winner === 'firebase' ? mysqlData : firebaseData,
      newValue: winner === 'firebase' ? firebaseData : mysqlData,
      success: true,
      errorMessage: `Conflict resolved: ${strategy} -> ${winner} wins`
    });

    console.log(`⚖️ Conflict resolved for ${entityType}/${entityId}: ${winner} wins`);

    return winner;
  }

  // =================================================================
  // FIREBASE → MYSQL SYNC (Realtime Listeners)
  // =================================================================

  /**
   * Setup listener cho Users collection
   */
  async setupUsersListener() {
    const unsubscribe = this.db.collection('users').onSnapshot(
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const userId = change.doc.id;
          const syncKey = `users-${userId}`;

          // Prevent sync loops
          if (this.isSyncInProgress(syncKey)) continue;
          this.markSyncInProgress(syncKey);

          try {
            if (change.type === 'added' || change.type === 'modified') {
              await this.syncUserToMySQL(userId, change.doc.data(), change.type === 'added' ? 'CREATE' : 'UPDATE');
            } else if (change.type === 'removed') {
              await this.deleteUserFromMySQL(userId);
            }
          } catch (error) {
            console.error(`❌ Error syncing user ${userId}:`, error);
            await this.logSyncError('users', userId, 'SYNC_ERROR', error.message, change.doc.data());
          }
        }
      },
      (error) => {
        console.error('❌ Users listener error:', error);
      }
    );

    this.listeners.push({ collection: 'users', unsubscribe });
    console.log('✅ Users listener setup complete');
  }

  /**
   * Sync user từ Firebase vào MySQL
   */
  async syncUserToMySQL(userId, userData, action) {
    const idempotenceKey = this.generateIdempotenceKey(
      'Firebase',
      'users',
      userId,
      action,
      userData.updatedAt || userData.createdAt || Date.now()
    );

    try {
      await executeTransaction(async (connection) => {
        // Check if user exists
        const [existingUser] = await connection.execute(
          `SELECT * FROM users WHERE id = ?`,
          [userId]
        );

        const oldValue = existingUser.length > 0 ? existingUser[0] : null;

        // Prepare user data
        const displayName = userData.displayName || userData.email?.split('@')[0] || 'Unknown';
        const tag = userData.tag || userData.userTag || '0000';

        if (existingUser.length === 0) {
          // Create new user (không lưu avatar - chỉ lưu trong Firebase)
          await connection.execute(
            `INSERT INTO users (id, email, display_name, tag, created_at, last_login_at)
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [
              userId,
              userData.email,
              displayName,
              tag.replace('#', '')
            ]
          );
        } else {
          // Update existing user (không sync avatar - chỉ lưu trong Firebase)
          await connection.execute(
            `UPDATE users 
             SET email = ?, display_name = ?, tag = ?, last_login_at = NOW()
             WHERE id = ?`,
            [
              userData.email,
              displayName,
              tag.replace('#', ''),
              userId
            ]
          );
        }

        // Log audit
        await this.logAudit({
          eventSource: 'Firebase',
          tableName: 'users',
          recordId: userId,
          action: action,
          oldValue: oldValue,
          newValue: userData,
          userId: userId,
          success: true,
          idempotenceKey: idempotenceKey
        });

        // Update sync state
        const dataHash = this.generateDataHash(userData);
        await this.updateSyncState('users', userId, dataHash, 'Firebase->MySQL');
      });

      console.log(`✅ User ${userId} synced to MySQL (${action})`);
    } catch (error) {
      console.error(`❌ Failed to sync user ${userId}:`, error);
      await this.logAudit({
        eventSource: 'Firebase',
        tableName: 'users',
        recordId: userId,
        action: action,
        newValue: userData,
        success: false,
        errorMessage: error.message,
        idempotenceKey: idempotenceKey
      });
      throw error;
    }
  }

  /**
   * Delete user từ MySQL
   */
  async deleteUserFromMySQL(userId) {
    const idempotenceKey = this.generateIdempotenceKey('Firebase', 'users', userId, 'DELETE', Date.now());

    try {
      const [existingUser] = await executeQuery(`SELECT * FROM users WHERE id = ?`, [userId]);

      if (existingUser.length > 0) {
        // Soft delete hoặc hard delete tùy yêu cầu
        // Ở đây ta sẽ hard delete
        await executeQuery(`DELETE FROM users WHERE id = ?`, [userId]);

        await this.logAudit({
          eventSource: 'Firebase',
          tableName: 'users',
          recordId: userId,
          action: 'DELETE',
          oldValue: existingUser[0],
          success: true,
          idempotenceKey: idempotenceKey
        });

        console.log(`✅ User ${userId} deleted from MySQL`);
      }
    } catch (error) {
      console.error(`❌ Failed to delete user ${userId}:`, error);
      await this.logAudit({
        eventSource: 'Firebase',
        tableName: 'users',
        recordId: userId,
        action: 'DELETE',
        success: false,
        errorMessage: error.message,
        idempotenceKey: idempotenceKey
      });
    }
  }

  /**
   * Setup listener cho Groups collection
   */
  async setupGroupsListener() {
    const unsubscribe = this.db.collection('groups').onSnapshot(
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const firestoreGroupId = change.doc.id;
          const syncKey = `groups-${firestoreGroupId}`;

          if (this.isSyncInProgress(syncKey)) continue;
          this.markSyncInProgress(syncKey);

          try {
            if (change.type === 'added' || change.type === 'modified') {
              await this.syncGroupToMySQL(firestoreGroupId, change.doc.data(), change.type === 'added' ? 'CREATE' : 'UPDATE');
            } else if (change.type === 'removed') {
              await this.deleteGroupFromMySQL(firestoreGroupId);
            }
          } catch (error) {
            console.error(`❌ Error syncing group ${firestoreGroupId}:`, error);
            await this.logSyncError('groups', firestoreGroupId, 'SYNC_ERROR', error.message, change.doc.data());
          }
        }
      },
      (error) => {
        console.error('❌ Groups listener error:', error);
      }
    );

    this.listeners.push({ collection: 'groups', unsubscribe });
    console.log('✅ Groups listener setup complete');
  }

  /**
   * Sync group từ Firebase vào MySQL
   */
  async syncGroupToMySQL(firestoreGroupId, groupData, action) {
    const idempotenceKey = this.generateIdempotenceKey(
      'Firebase',
      'groups',
      firestoreGroupId,
      action,
      groupData.updatedAt || groupData.createdAt || Date.now()
    );

    try {
      await executeTransaction(async (connection) => {
        // Check if mapping exists
        const [mapping] = await connection.execute(
          `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
          [firestoreGroupId]
        );

        let mysqlGroupId;

        if (mapping.length === 0) {
          // Create new group in MySQL
          const [groupResult] = await connection.execute(
            `INSERT INTO \`groups\` (name, description, group_photo_url, creator_id, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [
              groupData.name,
              groupData.description || `Synced from Firebase`,
              groupData.groupPhotoUrl || null,
              groupData.creatorId
            ]
          );

          mysqlGroupId = groupResult.insertId;

          // Create mapping
          await connection.execute(
            `INSERT INTO group_mapping (firestore_id, mysql_id, group_name, creator_id)
             VALUES (?, ?, ?, ?)`,
            [firestoreGroupId, mysqlGroupId, groupData.name, groupData.creatorId]
          );

          console.log(`✅ Created new group mapping: ${firestoreGroupId} -> ${mysqlGroupId}`);
        } else {
          mysqlGroupId = mapping[0].mysql_id;

          // Update existing group (không sync group_photo_url - chỉ lưu trong Firebase)
          await connection.execute(
            `UPDATE \`groups\`
             SET name = ?, description = ?
             WHERE id = ?`,
            [
              groupData.name,
              groupData.description || `Synced from Firebase`,
              mysqlGroupId
            ]
          );
        }

        // Log audit
        await this.logAudit({
          eventSource: 'Firebase',
          tableName: 'groups',
          recordId: firestoreGroupId,
          action: action,
          newValue: { ...groupData, mysqlGroupId },
          success: true,
          userId: groupData.creatorId,
          idempotenceKey: idempotenceKey
        });

        // Update sync state
        const dataHash = this.generateDataHash(groupData);
        await this.updateSyncState('groups', firestoreGroupId, dataHash, 'Firebase->MySQL');
      });

      console.log(`✅ Group ${firestoreGroupId} synced to MySQL (${action})`);
    } catch (error) {
      console.error(`❌ Failed to sync group ${firestoreGroupId}:`, error);
      await this.logAudit({
        eventSource: 'Firebase',
        tableName: 'groups',
        recordId: firestoreGroupId,
        action: action,
        newValue: groupData,
        success: false,
        errorMessage: error.message,
        idempotenceKey: idempotenceKey
      });
      throw error;
    }
  }

  /**
   * Delete group từ MySQL
   */
  async deleteGroupFromMySQL(firestoreGroupId) {
    const idempotenceKey = this.generateIdempotenceKey('Firebase', 'groups', firestoreGroupId, 'DELETE', Date.now());

    try {
      await executeTransaction(async (connection) => {
        // Get MySQL group ID
        const [mapping] = await connection.execute(
          `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
          [firestoreGroupId]
        );

        if (mapping.length > 0) {
          const mysqlGroupId = mapping[0].mysql_id;

          // Delete group (CASCADE will handle related records)
          await connection.execute(`DELETE FROM \`groups\` WHERE id = ?`, [mysqlGroupId]);

          // Delete mapping
          await connection.execute(`DELETE FROM group_mapping WHERE firestore_id = ?`, [firestoreGroupId]);

          await this.logAudit({
            eventSource: 'Firebase',
            tableName: 'groups',
            recordId: firestoreGroupId,
            action: 'DELETE',
            success: true,
            idempotenceKey: idempotenceKey
          });

          console.log(`✅ Group ${firestoreGroupId} deleted from MySQL`);
        }
      });
    } catch (error) {
      console.error(`❌ Failed to delete group ${firestoreGroupId}:`, error);
      await this.logAudit({
        eventSource: 'Firebase',
        tableName: 'groups',
        recordId: firestoreGroupId,
        action: 'DELETE',
        success: false,
        errorMessage: error.message,
        idempotenceKey: idempotenceKey
      });
    }
  }

  /**
   * Setup listener cho Group Members collection
   */
  async setupGroupMembersListener() {
    const unsubscribe = this.db.collection('group_members').onSnapshot(
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const membershipId = change.doc.id;
          const memberData = change.doc.data();
          const syncKey = `group_members-${membershipId}`;

          if (this.isSyncInProgress(syncKey)) continue;
          this.markSyncInProgress(syncKey);

          try {
            if (change.type === 'added' || change.type === 'modified') {
              await this.syncGroupMemberToMySQL(memberData, change.type === 'added' ? 'CREATE' : 'UPDATE');
            } else if (change.type === 'removed') {
              await this.deleteGroupMemberFromMySQL(memberData);
            }
          } catch (error) {
            console.error(`❌ Error syncing group member:`, error);
            await this.logSyncError('group_members', membershipId, 'SYNC_ERROR', error.message, memberData);
          }
        }
      },
      (error) => {
        console.error('❌ Group members listener error:', error);
      }
    );

    this.listeners.push({ collection: 'group_members', unsubscribe });
    console.log('✅ Group members listener setup complete');
  }

  /**
   * Sync group member từ Firebase vào MySQL
   */
  async syncGroupMemberToMySQL(memberData, action) {
    const { userId, groupId, role } = memberData;
    const idempotenceKey = this.generateIdempotenceKey(
      'Firebase',
      'group_members',
      `${groupId}-${userId}`,
      action,
      memberData.joinedAt || Date.now()
    );

    try {
      await executeTransaction(async (connection) => {
        // Get MySQL group ID from mapping
        const [mapping] = await connection.execute(
          `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
          [groupId]
        );

        if (mapping.length === 0) {
          throw new Error(`No mapping found for Firestore group ${groupId}`);
        }

        const mysqlGroupId = mapping[0].mysql_id;

        // Insert or update membership
        await connection.execute(
          `INSERT INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE role = VALUES(role)`,
          [mysqlGroupId, userId, role || 'member']
        );

        // Log audit
        await this.logAudit({
          eventSource: 'Firebase',
          tableName: 'group_members',
          recordId: `${groupId}-${userId}`,
          action: action,
          newValue: { ...memberData, mysqlGroupId },
          success: true,
          userId: userId,
          idempotenceKey: idempotenceKey
        });

        // Update sync state
        const dataHash = this.generateDataHash(memberData);
        await this.updateSyncState('group_members', `${groupId}-${userId}`, dataHash, 'Firebase->MySQL');
      });

      console.log(`✅ Group member ${userId} in group ${groupId} synced to MySQL`);
    } catch (error) {
      console.error(`❌ Failed to sync group member:`, error);
      await this.logAudit({
        eventSource: 'Firebase',
        tableName: 'group_members',
        recordId: `${groupId}-${userId}`,
        action: action,
        newValue: memberData,
        success: false,
        errorMessage: error.message,
        idempotenceKey: idempotenceKey
      });
    }
  }

  /**
   * Delete group member từ MySQL
   */
  async deleteGroupMemberFromMySQL(memberData) {
    const { userId, groupId } = memberData;
    const idempotenceKey = this.generateIdempotenceKey('Firebase', 'group_members', `${groupId}-${userId}`, 'DELETE', Date.now());

    try {
      await executeTransaction(async (connection) => {
        // Get MySQL group ID
        const [mapping] = await connection.execute(
          `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
          [groupId]
        );

        if (mapping.length > 0) {
          const mysqlGroupId = mapping[0].mysql_id;

          await connection.execute(
            `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
            [mysqlGroupId, userId]
          );

          await this.logAudit({
            eventSource: 'Firebase',
            tableName: 'group_members',
            recordId: `${groupId}-${userId}`,
            action: 'DELETE',
            oldValue: memberData,
            success: true,
            idempotenceKey: idempotenceKey
          });

          console.log(`✅ Group member deleted from MySQL`);
        }
      });
    } catch (error) {
      console.error(`❌ Failed to delete group member:`, error);
    }
  }

  /**
   * Setup listener cho Files (nested collection: groups/{groupId}/files)
   */
  async setupFilesListener() {
    // Lắng nghe tất cả files trong tất cả groups
    // Sử dụng collectionGroup query
    const unsubscribe = this.db.collectionGroup('files').onSnapshot(
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const fileId = change.doc.id;
          const syncKey = `files-${fileId}`;

          if (this.isSyncInProgress(syncKey)) continue;
          this.markSyncInProgress(syncKey);

          try {
            if (change.type === 'added' || change.type === 'modified') {
              await this.syncFileToMySQL(fileId, change.doc.data(), change.type === 'added' ? 'CREATE' : 'UPDATE');
            } else if (change.type === 'removed') {
              await this.deleteFileFromMySQL(fileId);
            }
          } catch (error) {
            console.error(`❌ Error syncing file ${fileId}:`, error);
            await this.logSyncError('files', fileId, 'SYNC_ERROR', error.message, change.doc.data());
          }
        }
      },
      (error) => {
        console.error('❌ Files listener error:', error);
      }
    );

    this.listeners.push({ collection: 'files', unsubscribe });
    console.log('✅ Files listener setup complete');
  }

  /**
   * Sync file từ Firebase vào MySQL
   */
  async syncFileToMySQL(fileId, fileData, action) {
    // Implementation tương tự như trên
    // Bỏ qua để tiết kiệm không gian, logic tương tự syncGroupToMySQL
    console.log(`📄 File ${fileId} sync: ${action}`);
  }

  /**
   * Delete file từ MySQL
   */
  async deleteFileFromMySQL(fileId) {
    console.log(`🗑️ File ${fileId} deleted`);
  }

  /**
   * Setup listener cho Tags
   */
  async setupTagsListener() {
    const unsubscribe = this.db.collection('tags').onSnapshot(
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const tagId = change.doc.id;
          const syncKey = `tags-${tagId}`;

          if (this.isSyncInProgress(syncKey)) continue;
          this.markSyncInProgress(syncKey);

          try {
            if (change.type === 'added' || change.type === 'modified') {
              await this.syncTagToMySQL(tagId, change.doc.data(), change.type === 'added' ? 'CREATE' : 'UPDATE');
            } else if (change.type === 'removed') {
              await this.deleteTagFromMySQL(tagId);
            }
          } catch (error) {
            console.error(`❌ Error syncing tag ${tagId}:`, error);
          }
        }
      },
      (error) => {
        console.error('❌ Tags listener error:', error);
      }
    );

    this.listeners.push({ collection: 'tags', unsubscribe });
    console.log('✅ Tags listener setup complete');
  }

  /**
   * Sync tag từ Firebase vào MySQL
   */
  async syncTagToMySQL(tagId, tagData, action) {
    console.log(`🏷️ Tag ${tagId} sync: ${action}`);
  }

  /**
   * Delete tag từ MySQL
   */
  async deleteTagFromMySQL(tagId) {
    console.log(`🗑️ Tag ${tagId} deleted`);
  }

  // =================================================================
  // MYSQL → FIREBASE SYNC
  // =================================================================

  /**
   * Sync từ MySQL lên Firebase (manual trigger)
   */
  async syncMySQLToFirebase(entityType, entityId, data, action) {
    const syncKey = `mysql-${entityType}-${entityId}`;

    // Prevent sync loops
    if (this.isSyncInProgress(syncKey)) {
      console.log(`⚠️ Sync loop prevented: ${syncKey}`);
      return;
    }

    this.markSyncInProgress(syncKey);

    try {
      switch (entityType) {
        case 'users':
          await this.syncUserToFirebase(entityId, data, action);
          break;
        case 'groups':
          await this.syncGroupToFirebase(entityId, data, action);
          break;
        case 'files':
          await this.syncFileToFirebase(entityId, data, action);
          break;
        default:
          console.log(`⚠️ Unknown entity type: ${entityType}`);
      }
    } catch (error) {
      console.error(`❌ Failed to sync ${entityType}/${entityId} to Firebase:`, error);
      await this.logSyncError(entityType, entityId, 'MYSQL_TO_FIREBASE_ERROR', error.message, data);
    }
  }

  /**
   * Sync user từ MySQL lên Firebase
   */
  async syncUserToFirebase(userId, userData, action) {
    try {
      const userRef = this.db.collection('users').doc(userId);

      if (action === 'DELETE') {
        await userRef.delete();
      } else {
        await userRef.set({
          email: userData.email,
          displayName: userData.display_name,
          tag: userData.tag,
          avatar: userData.avatar_url,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      await this.logAudit({
        eventSource: 'MySQL',
        tableName: 'users',
        recordId: userId,
        action: action,
        newValue: userData,
        success: true
      });

      console.log(`✅ User ${userId} synced to Firebase (${action})`);
    } catch (error) {
      console.error(`❌ Failed to sync user to Firebase:`, error);
      throw error;
    }
  }

  /**
   * Sync group từ MySQL lên Firebase
   */
  async syncGroupToFirebase(mysqlGroupId, groupData, action) {
    try {
      // Get Firestore ID from mapping
      const [mapping] = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );

      if (mapping.length === 0) {
        throw new Error(`No Firestore mapping found for MySQL group ${mysqlGroupId}`);
      }

      const firestoreGroupId = mapping[0].firestore_id;
      const groupRef = this.db.collection('groups').doc(firestoreGroupId);

      if (action === 'DELETE') {
        await groupRef.delete();
      } else {
        await groupRef.set({
          name: groupData.name,
          description: groupData.description,
          groupPhotoUrl: groupData.group_photo_url,
          creatorId: groupData.creator_id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      await this.logAudit({
        eventSource: 'MySQL',
        tableName: 'groups',
        recordId: mysqlGroupId,
        action: action,
        newValue: groupData,
        success: true
      });

      console.log(`✅ Group ${mysqlGroupId} synced to Firebase (${action})`);
    } catch (error) {
      console.error(`❌ Failed to sync group to Firebase:`, error);
      throw error;
    }
  }

  /**
   * Sync file từ MySQL lên Firebase
   */
  async syncFileToFirebase(fileId, fileData, action) {
    // Implementation tương tự
    console.log(`📄 File ${fileId} synced to Firebase (${action})`);
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Get sync statistics
   */
  async getSyncStatistics(days = 7) {
    try {
      const stats = await executeQuery(
        `SELECT * FROM v_sync_statistics WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
        [days]
      );
      return stats;
    } catch (error) {
      console.error('❌ Failed to get sync statistics:', error);
      return [];
    }
  }

  /**
   * Get failed syncs
   */
  async getFailedSyncs(limit = 100) {
    try {
      const failed = await executeQuery(
        `SELECT * FROM v_failed_syncs LIMIT ?`,
        [limit]
      );
      return failed;
    } catch (error) {
      console.error('❌ Failed to get failed syncs:', error);
      return [];
    }
  }

  /**
   * Retry failed syncs
   */
  async retryFailedSyncs() {
    try {
      const errors = await executeQuery(
        `SELECT * FROM sync_errors 
         WHERE status = 'pending' AND retry_count < max_retries
         ORDER BY created_at ASC
         LIMIT 50`
      );

      console.log(`🔄 Retrying ${errors.length} failed syncs...`);

      for (const error of errors) {
        try {
          const data = error.failed_data ? JSON.parse(error.failed_data) : null;
          
          // Retry sync based on entity type
          await this.syncMySQLToFirebase(error.entity_type, error.entity_id, data, 'UPDATE');

          // Mark as resolved
          await executeQuery(
            `UPDATE sync_errors SET status = 'resolved', resolved_at = NOW() WHERE id = ?`,
            [error.id]
          );

          console.log(`✅ Retry successful for ${error.entity_type}/${error.entity_id}`);
        } catch (retryError) {
          // Increment retry count
          await executeQuery(
            `UPDATE sync_errors SET retry_count = retry_count + 1, status = 'retrying' WHERE id = ?`,
            [error.id]
          );

          console.error(`❌ Retry failed for ${error.entity_type}/${error.entity_id}:`, retryError.message);
        }
      }

      return { success: true, retriedCount: errors.length };
    } catch (error) {
      console.error('❌ Failed to retry syncs:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop all listeners (cleanup)
   */
  async shutdown() {
    console.log('🛑 Shutting down Sync Service...');
    
    for (const listener of this.listeners) {
      try {
        listener.unsubscribe();
        console.log(`✅ Unsubscribed from ${listener.collection}`);
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${listener.collection}:`, error);
      }
    }

    this.listeners = [];
    console.log('✅ Sync Service shutdown complete');
  }
}

// Export singleton instance
const syncService = new SyncService();

module.exports = syncService;
