/**
 * =================================================================
 * SYNC MONITORING ROUTES
 * =================================================================
 * API endpoints để giám sát và quản lý đồng bộ
 */

const express = require('express');
const router = express.Router();
const syncService = require('../config/syncService');
const { executeQuery } = require('../config/db');
const verifyFirebaseToken = require('../middleware/firebaseAuth');

/**
 * GET /api/sync/status
 * Lấy trạng thái tổng quan của hệ thống đồng bộ
 */
router.get('/status', verifyFirebaseToken, async (req, res) => {
  try {
    // Get basic stats
    const [syncStats] = await executeQuery(`
      SELECT 
        COUNT(*) as total_syncs,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_syncs,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_syncs,
        COUNT(DISTINCT table_name) as tables_synced,
        MAX(timestamp) as last_sync_time
      FROM audit_log
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    // Get sync by source
    const syncBySource = await executeQuery(`
      SELECT 
        event_source,
        COUNT(*) as count,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed
      FROM audit_log
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY event_source
    `);

    // Get sync by table
    const syncByTable = await executeQuery(`
      SELECT 
        table_name,
        action,
        COUNT(*) as count
      FROM audit_log
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY table_name, action
      ORDER BY count DESC
    `);

    // Get active errors
    const [errorStats] = await executeQuery(`
      SELECT 
        COUNT(*) as total_errors,
        COUNT(DISTINCT entity_type) as affected_entities,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_errors,
        MAX(created_at) as last_error_time
      FROM sync_errors
      WHERE status IN ('pending', 'retrying')
    `);

    res.json({
      success: true,
      data: {
        overview: syncStats,
        bySource: syncBySource,
        byTable: syncByTable,
        errors: errorStats,
        listenersActive: syncService.listeners.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

/**
 * GET /api/sync/statistics
 * Lấy thống kê chi tiết theo ngày
 */
router.get('/statistics', verifyFirebaseToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const stats = await syncService.getSyncStatistics(parseInt(days));

    res.json({
      success: true,
      data: stats,
      period: `${days} days`
    });
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/sync/audit-log
 * Lấy audit log với filter và pagination
 */
router.get('/audit-log', verifyFirebaseToken, async (req, res) => {
  try {
    const {
      table_name,
      action,
      event_source,
      success,
      limit = 100,
      offset = 0
    } = req.query;

    let whereConditions = [];
    let params = [];

    if (table_name) {
      whereConditions.push('table_name = ?');
      params.push(table_name);
    }

    if (action) {
      whereConditions.push('action = ?');
      params.push(action);
    }

    if (event_source) {
      whereConditions.push('event_source = ?');
      params.push(event_source);
    }

    if (success !== undefined) {
      whereConditions.push('success = ?');
      params.push(success === 'true' || success === true);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    params.push(parseInt(limit), parseInt(offset));

    const logs = await executeQuery(`
      SELECT 
        al.*,
        u.display_name as user_name,
        u.email as user_email
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT ? OFFSET ?
    `, params);

    // Get total count
    const countParams = params.slice(0, -2); // Remove limit and offset
    const [countResult] = await executeQuery(`
      SELECT COUNT(*) as total
      FROM audit_log
      ${whereClause}
    `, countParams);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total: countResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: countResult.total > (parseInt(offset) + parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error getting audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit log',
      message: error.message
    });
  }
});

/**
 * GET /api/sync/errors
 * Lấy danh sách lỗi đồng bộ
 */
router.get('/errors', verifyFirebaseToken, async (req, res) => {
  try {
    const { status = 'pending', limit = 50 } = req.query;

    const errors = await executeQuery(`
      SELECT 
        se.*,
        al.timestamp as last_attempt_time,
        al.error_message as last_error_message
      FROM sync_errors se
      LEFT JOIN audit_log al ON 
        se.entity_type = al.table_name AND 
        se.entity_id = al.record_id
      WHERE se.status = ?
      ORDER BY se.created_at DESC
      LIMIT ?
    `, [status, parseInt(limit)]);

    res.json({
      success: true,
      data: errors,
      count: errors.length
    });
  } catch (error) {
    console.error('❌ Error getting sync errors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync errors',
      message: error.message
    });
  }
});

/**
 * POST /api/sync/retry-failed
 * Retry các sync đã fail
 */
router.post('/retry-failed', verifyFirebaseToken, async (req, res) => {
  try {
    const result = await syncService.retryFailedSyncs();

    res.json({
      success: result.success,
      message: `Retried ${result.retriedCount} failed syncs`,
      data: result
    });
  } catch (error) {
    console.error('❌ Error retrying failed syncs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry syncs',
      message: error.message
    });
  }
});

/**
 * POST /api/sync/manual-sync
 * Manually trigger sync cho một entity cụ thể
 */
router.post('/manual-sync', verifyFirebaseToken, async (req, res) => {
  try {
    const { entityType, entityId, direction = 'Firebase->MySQL' } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'entityType and entityId are required'
      });
    }

    // Get data from source
    let data;
    if (direction === 'MySQL->Firebase') {
      // Get from MySQL
      const [result] = await executeQuery(
        `SELECT * FROM ?? WHERE id = ?`,
        [entityType, entityId]
      );
      data = result;
    } else {
      // Get from Firebase
      const doc = await syncService.db.collection(entityType).doc(entityId).get();
      data = doc.exists ? doc.data() : null;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found'
      });
    }

    // Trigger sync
    if (direction === 'MySQL->Firebase') {
      await syncService.syncMySQLToFirebase(entityType, entityId, data, 'UPDATE');
    } else {
      // Will be handled by listeners automatically
      console.log('Firebase->MySQL sync will be triggered by listeners');
    }

    res.json({
      success: true,
      message: `Manual sync triggered for ${entityType}/${entityId}`,
      direction: direction
    });
  } catch (error) {
    console.error('❌ Error in manual sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger manual sync',
      message: error.message
    });
  }
});

/**
 * GET /api/sync/health
 * Health check cho sync service
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      listeners: syncService.listeners.length,
      timestamp: new Date().toISOString()
    };

    // Check last sync time
    const [lastSync] = await executeQuery(`
      SELECT MAX(timestamp) as last_sync FROM audit_log
    `);

    if (lastSync.last_sync) {
      const minutesSinceLastSync = Math.floor(
        (Date.now() - new Date(lastSync.last_sync).getTime()) / 1000 / 60
      );
      
      health.lastSyncMinutesAgo = minutesSinceLastSync;
      
      // Warning if no sync in last 10 minutes
      if (minutesSinceLastSync > 10) {
        health.status = 'warning';
        health.warning = 'No recent sync activity';
      }
    }

    // Check for pending errors
    const [pendingErrors] = await executeQuery(`
      SELECT COUNT(*) as count FROM sync_errors WHERE status = 'pending'
    `);

    health.pendingErrors = pendingErrors.count;

    if (pendingErrors.count > 10) {
      health.status = 'degraded';
      health.alert = 'High number of pending errors';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });
  } catch (error) {
    console.error('❌ Error checking sync health:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/sync/dashboard
 * Complete dashboard data
 */
router.get('/dashboard', verifyFirebaseToken, async (req, res) => {
  try {
    // Last 24 hours overview
    const [overview] = await executeQuery(`
      SELECT 
        COUNT(*) as total_operations,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed,
        ROUND(SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
      FROM audit_log
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    // Hourly activity (last 24 hours)
    const hourlyActivity = await executeQuery(`
      SELECT 
        DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as count,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed
      FROM audit_log
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY hour
      ORDER BY hour
    `);

    // Top synced tables
    const topTables = await executeQuery(`
      SELECT 
        table_name,
        COUNT(*) as operations,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed
      FROM audit_log
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY table_name
      ORDER BY operations DESC
      LIMIT 10
    `);

    // Recent errors
    const recentErrors = await executeQuery(`
      SELECT 
        entity_type,
        entity_id,
        error_type,
        error_message,
        retry_count,
        created_at
      FROM sync_errors
      WHERE status IN ('pending', 'retrying')
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // Sync latency (average time between Firebase and MySQL updates)
    const [latency] = await executeQuery(`
      SELECT 
        AVG(TIMESTAMPDIFF(SECOND, ss.firebase_version, ss.mysql_version)) as avg_latency_seconds
      FROM sync_state ss
      WHERE ss.last_synced_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND ss.firebase_version IS NOT NULL
        AND ss.mysql_version IS NOT NULL
    `);

    res.json({
      success: true,
      data: {
        overview: overview,
        hourlyActivity: hourlyActivity,
        topTables: topTables,
        recentErrors: recentErrors,
        averageLatency: latency.avg_latency_seconds || 0,
        listeners: syncService.listeners.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

/**
 * DELETE /api/sync/clear-old-logs
 * Xóa audit logs cũ (older than X days)
 */
router.delete('/clear-old-logs', verifyFirebaseToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await executeQuery(`
      DELETE FROM audit_log 
      WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [parseInt(days)]);

    res.json({
      success: true,
      message: `Cleared audit logs older than ${days} days`,
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error('❌ Error clearing old logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear old logs',
      message: error.message
    });
  }
});

module.exports = router;
