require('dotenv').config();
const { pool } = require('../config/database');
const fs = require('fs');

async function createLogsTable() {
  let client;
  try {
    client = await pool.connect();
    console.log('🔧 Creando tabla logs_auditoria...\n');

    const sql = fs.readFileSync('./scripts/create_logs_auditoria.sql', 'utf8');
    await client.query(sql);

    console.log('✅ Tabla logs_auditoria creada exitosamente');

    // Verificar que la tabla existe
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'logs_auditoria'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verificación: Tabla logs_auditoria existe');
    } else {
      console.log('❌ Error: Tabla no fue creada');
    }

  } catch (error) {
    console.error('❌ Error creando tabla:', error);
  } finally {
    if (client) client.release();
  }
}

createLogsTable();