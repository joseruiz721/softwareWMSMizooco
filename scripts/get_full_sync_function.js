require('dotenv').config();
const { pool } = require('../config/database');

async function getFullSyncFunction() {
  let client;
  try {
    client = await pool.connect();

    const func = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc
      WHERE proname = 'sync_usuario_estado'
    `);

    if (func.rows.length > 0) {
      console.log('📄 FUNCIÓN COMPLETA sync_usuario_estado:');
      console.log(func.rows[0].def);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

getFullSyncFunction();