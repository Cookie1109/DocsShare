/**
 * =================================================================
 * SYNC HELPER - Auto-sync MySQL changes to Firebase
 * =================================================================
 * 
 * Wrapper để tự động trigger sync sau mỗi MySQL operation
 */

const syncService = require('./syncService');

class SyncHelper {
  /**
   * Execute a MySQL operation và auto-sync to Firebase
   * @param {Function} mysqlOperation - Function thực hiện MySQL operation
   * @param {Object} syncConfig - Config cho sync
   * @param {string} syncConfig.entityType - Loại entity ('users', 'groups', 'files', 'tags')
   * @param {string} syncConfig.entityId - ID của entity
   * @param {string} syncConfig.action - Action type ('CREATE', 'UPDATE', 'DELETE')
   * @param {Object} syncConfig.data - Data để sync
   * @param {string} syncConfig.userId - User thực hiện action
   * @returns {Promise<Object>} Kết quả operation
   */
  static async executeWithSync(mysqlOperation, syncConfig) {
    const { entityType, entityId, action, data, userId } = syncConfig;

    try {
      // 1. Execute MySQL operation first
      const result = await mysqlOperation();

      // 2. If MySQL success, trigger sync to Firebase
      if (result.success) {
        try {
          await syncService.syncMySQLToFirebase(
            entityType,
            entityId,
            data,
            action
          );

          console.log(`✅ Synced ${entityType}/${entityId} to Firebase after ${action}`);
        } catch (syncError) {
          // Log sync error but don't fail the main operation
          console.error(`⚠️ Firebase sync failed for ${entityType}/${entityId}:`, syncError.message);
          
          // Log to sync_errors table for retry
          await syncService.logSyncError(
            entityType,
            entityId,
            'MYSQL_TO_FIREBASE_SYNC_FAILED',
            syncError.message,
            data
          );
        }
      }

      return result;
    } catch (error) {
      console.error(`❌ MySQL operation failed for ${entityType}/${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Wrapper cho User operations
   */
  static async syncUser(userId, action, data) {
    try {
      await syncService.syncMySQLToFirebase('users', userId, data, action);
      return { success: true };
    } catch (error) {
      console.error(`❌ User sync failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Wrapper cho Group operations
   */
  static async syncGroup(groupId, action, data) {
    try {
      // Cần convert MySQL group ID sang Firestore ID
      const { executeQuery } = require('./db');
      const [mapping] = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [groupId]
      );

      if (mapping.length === 0) {
        console.warn(`⚠️ No Firestore mapping for MySQL group ${groupId}`);
        return { success: false, error: 'No Firestore mapping' };
      }

      const firestoreGroupId = mapping[0].firestore_id;
      await syncService.syncMySQLToFirebase('groups', firestoreGroupId, data, action);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Group sync failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Wrapper cho File operations
   */
  static async syncFile(fileId, groupId, action, data) {
    try {
      // Files are nested in Firestore: groups/{groupId}/files/{fileId}
      // Cần Firestore group ID
      const { executeQuery } = require('./db');
      const [mapping] = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [groupId]
      );

      if (mapping.length === 0) {
        console.warn(`⚠️ No Firestore mapping for group ${groupId}`);
        return { success: false, error: 'No Firestore mapping' };
      }

      const firestoreGroupId = mapping[0].firestore_id;
      const admin = require('./firebaseAdmin');
      const db = admin.firestore();

      if (action === 'DELETE') {
        await db
          .collection('groups')
          .doc(firestoreGroupId)
          .collection('files')
          .doc(fileId.toString())
          .delete();
      } else {
        await db
          .collection('groups')
          .doc(firestoreGroupId)
          .collection('files')
          .doc(fileId.toString())
          .set({
            ...data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ File sync failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Wrapper cho Tag operations
   */
  static async syncTag(tagId, groupId, action, data) {
    try {
      const { executeQuery } = require('./db');
      const [mapping] = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [groupId]
      );

      if (mapping.length === 0) {
        console.warn(`⚠️ No Firestore mapping for group ${groupId}`);
        return { success: false, error: 'No Firestore mapping' };
      }

      const firestoreGroupId = mapping[0].firestore_id;
      const admin = require('./firebaseAdmin');
      const db = admin.firestore();

      if (action === 'DELETE') {
        // Delete tag from Firestore tags collection
        await db
          .collection('tags')
          .doc(tagId.toString())
          .delete();
      } else {
        // Update or create tag in Firestore
        await db
          .collection('tags')
          .doc(tagId.toString())
          .set({
            ...data,
            groupId: firestoreGroupId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ Tag sync failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync group member changes
   */
  static async syncGroupMember(groupId, userId, action, data) {
    try {
      const { executeQuery } = require('./db');
      const [mapping] = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [groupId]
      );

      if (mapping.length === 0) {
        console.warn(`⚠️ No Firestore mapping for group ${groupId}`);
        return { success: false, error: 'No Firestore mapping' };
      }

      const firestoreGroupId = mapping[0].firestore_id;
      const admin = require('./firebaseAdmin');
      const db = admin.firestore();

      if (action === 'DELETE') {
        // Find and delete the membership document
        const snapshot = await db
          .collection('group_members')
          .where('groupId', '==', firestoreGroupId)
          .where('userId', '==', userId)
          .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } else {
        // Check if membership exists
        const snapshot = await db
          .collection('group_members')
          .where('groupId', '==', firestoreGroupId)
          .where('userId', '==', userId)
          .get();

        if (snapshot.empty) {
          // Create new membership
          await db.collection('group_members').add({
            groupId: firestoreGroupId,
            userId: userId,
            role: data.role || 'member',
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Update existing membership
          const doc = snapshot.docs[0];
          await doc.ref.update({
            role: data.role || 'member',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ Group member sync failed:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SyncHelper;
