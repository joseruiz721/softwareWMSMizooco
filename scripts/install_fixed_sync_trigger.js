require('dotenv').config();
const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function installFixedSyncTrigger() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔧 INSTALANDO VERSIÓN CORREGIDA DE sync_usuario_estado...\n');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'sync_estado_fixed.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar el SQL
    await client.query(sqlContent);

    console.log('✅ Trigger corregido instalado exitosamente');

  } catch (error) {
    console.error('❌ Error instalando trigger corregido:', error);
  } finally {
    if (client) client.release();
  }
}

installFixedSyncTrigger();