require('dotenv').config();
const { pool } = require('../config/database');

async function checkSyncFunction() {
  let client;
  try {
    client = await pool.connect();

    const func = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc
      WHERE proname = 'sync_usuario_estado'
    `);

    if (func.rows.length > 0) {
      const def = func.rows[0].def;
      console.log('📄 FUNCIÓN sync_usuario_estado:');
      console.log(def.substring(0, 200) + '...');

      const hasDebug = def.includes('RAISE NOTICE');
      console.log(`🔍 ¿Tiene debug?: ${hasDebug ? 'SÍ' : 'NO'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

checkSyncFunction();