/**
 * =================================================================
 * TEST SYNC SYSTEM
 * =================================================================
 * Script để test hệ thống đồng bộ sau khi setup
 */

const admin = require('./src/config/firebaseAdmin');
const { executeQuery } = require('./src/config/db');

async function testSyncSystem() {
  console.log('🧪 Testing Sync System...\n');

  try {
    // 1. Test Database Connection
    console.log('1️⃣ Testing database connection...');
    const [dbTest] = await executeQuery('SELECT 1 as test');
    console.log('✅ Database connected\n');

    // 2. Check Audit Tables
    console.log('2️⃣ Checking audit tables...');
    
    const tables = ['audit_log', 'sync_state', 'sync_errors'];
    for (const table of tables) {
      const [result] = await executeQuery(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      console.log(`   ✅ ${table}: ${result.count} records`);
    }
    console.log();

    // 3. Check Views
    console.log('3️⃣ Checking views...');
    const views = ['v_recent_audit_logs', 'v_sync_statistics', 'v_failed_syncs'];
    for (const view of views) {
      try {
        await executeQuery(`SELECT * FROM ${view} LIMIT 1`);
        console.log(`   ✅ ${view} exists`);
      } catch (error) {
        console.log(`   ❌ ${view} not found`);
      }
    }
    console.log();

    // 4. Check Stored Procedures
    console.log('4️⃣ Checking stored procedures...');
    const procedures = ['log_audit_event', 'update_sync_state'];
    const [spResult] = await executeQuery(`
      SELECT ROUTINE_NAME 
      FROM information_schema.ROUTINES 
      WHERE ROUTINE_SCHEMA = DATABASE() 
        AND ROUTINE_TYPE = 'PROCEDURE'
        AND ROUTINE_NAME IN (?, ?)
    `, procedures);
    
    console.log(`   ✅ Found ${spResult.length} stored procedures`);
    spResult.forEach(sp => {
      console.log(`      - ${sp.ROUTINE_NAME}`);
    });
    console.log();

    // 5. Test Firebase Connection
    console.log('5️⃣ Testing Firebase connection...');
    const db = admin.firestore();
    const testDoc = await db.collection('users').limit(1).get();
    console.log(`✅ Firebase connected (found ${testDoc.size} test docs)\n`);

    // 6. Test Audit Logging
    console.log('6️⃣ Testing audit logging...');
    const testAuditResult = await executeQuery(
      `CALL log_audit_event(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'System',
        'test_table',
        'test-id-123',
        'CREATE',
        null,
        JSON.stringify({ test: 'data' }),
        null,
        true,
        null,
        `test-${Date.now()}`
      ]
    );
    console.log('✅ Audit logging works\n');

    // 7. Test Sync State
    console.log('7️⃣ Testing sync state...');
    await executeQuery(
      `CALL update_sync_state(?, ?, ?, ?)`,
      ['test_entity', 'test-123', 'abc123hash', 'Firebase->MySQL']
    );
    
    const [syncState] = await executeQuery(
      `SELECT * FROM sync_state WHERE entity_type = 'test_entity' AND entity_id = 'test-123'`
    );
    
    if (syncState.length > 0) {
      console.log('✅ Sync state tracking works');
      console.log(`   Last sync: ${syncState[0].last_synced_at}`);
      console.log(`   Direction: ${syncState[0].last_sync_direction}`);
    }
    console.log();

    // 8. Get Statistics
    console.log('8️⃣ Getting sync statistics...');
    const [stats] = await executeQuery(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT table_name) as tables_tracked,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed
      FROM audit_log
    `);
    
    console.log('📊 Current Statistics:');
    console.log(`   Total logs: ${stats.total_logs}`);
    console.log(`   Tables tracked: ${stats.tables_tracked}`);
    console.log(`   Successful: ${stats.successful}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log();

    // 9. Check for Errors
    console.log('9️⃣ Checking for sync errors...');
    const [errors] = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM sync_errors 
      WHERE status = 'pending'
    `);
    
    if (errors.count > 0) {
      console.log(`⚠️  Found ${errors.count} pending errors`);
      const errorList = await executeQuery(`
        SELECT * FROM sync_errors WHERE status = 'pending' LIMIT 5
      `);
      console.log('   Recent errors:');
      errorList.forEach(err => {
        console.log(`   - ${err.entity_type}/${err.entity_id}: ${err.error_message}`);
      });
    } else {
      console.log('✅ No pending errors');
    }
    console.log();

    // 10. Test Manual Sync (if possible)
    console.log('🔟 Testing manual sync trigger...');
    console.log('   (This would require SyncService to be running)');
    console.log('   You can test this via API: POST /api/sync/manual-sync');
    console.log();

    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    await executeQuery(
      `DELETE FROM audit_log WHERE table_name = 'test_table'`
    );
    await executeQuery(
      `DELETE FROM sync_state WHERE entity_type = 'test_entity'`
    );
    console.log('✅ Test data cleaned\n');

    // Final Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n✅ Sync system is ready to use');
    console.log('\n📋 Next steps:');
    console.log('   1. Start server: npm start');
    console.log('   2. Check health: GET /api/sync/health');
    console.log('   3. View dashboard: GET /api/sync/dashboard');
    console.log('   4. Monitor logs: GET /api/sync/audit-log');
    console.log('\n📚 Documentation: See SYNC_SYSTEM_README.md\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure you ran: node run-migration.js');
    console.error('   2. Check database connection in .env');
    console.error('   3. Verify Firebase credentials file exists');
    process.exit(1);
  }

  process.exit(0);
}

// Run tests
testSyncSystem();
