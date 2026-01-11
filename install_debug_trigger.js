// Ejecutar trigger de debugging
require('dotenv').config();
const { pool } = require('./config/database');
const fs = require('fs');

async function installDebugTrigger() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔧 INSTALANDO TRIGGER DE DEBUGGING...\n');

    // Leer el SQL del archivo
    const sql = fs.readFileSync('./debug_trigger.sql', 'utf8');

    // Ejecutar el SQL
    await client.query(sql);
    console.log('Trigger de debugging instalado');

    // Probar UPDATE
    console.log('\n🔄 PROBANDO UPDATE CON TRIGGER DE DEBUG:');
    const update = await client.query('UPDATE usuarios SET estado = $1 WHERE id = $2', ['activo', 13]);
    console.log('Update result:', { rowCount: update.rowCount });

    // Ver resultado
    const result = await client.query('SELECT id, estado, activo FROM usuarios WHERE id = 13');
    console.log('Estado final:', result.rows[0]);

    // Reset
    await client.query('UPDATE usuarios SET estado = $1 WHERE id = $2', ['bloqueado', 13]);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

installDebugTrigger();