require('dotenv').config();
const { pool } = require('../config/database');

async function checkAllTriggers() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔍 VERIFICANDO TODOS LOS TRIGGERS DETALLADAMENTE...\n');

    const triggers = await client.query(`
      SELECT
        trigger_name,
        event_manipulation,
        action_timing,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'usuarios'
      ORDER BY action_timing, event_manipulation
    `);

    console.log('🎯 TRIGGERS EN TABLA USUARIOS:');
    triggers.rows.forEach(t => {
      console.log(`  - ${t.trigger_name}: ${t.action_timing} ${t.event_manipulation}`);
      console.log(`    -> ${t.action_statement.substring(0, 80)}...`);
    });

    // Verificar si hay triggers AFTER
    const afterTriggers = triggers.rows.filter(t => t.action_timing === 'AFTER');
    console.log(`\n⚠️  TRIGGERS AFTER UPDATE: ${afterTriggers.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

checkAllTriggers();