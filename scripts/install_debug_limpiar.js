require('dotenv').config();
const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function installDebugLimpiarTrigger() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔧 INSTALANDO TRIGGER DE DEBUG PARA limpiar_usuarios_eliminados...\n');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'debug_limpiar_trigger.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar el SQL
    await client.query(sqlContent);

    console.log('✅ Trigger de debug instalado exitosamente');
    console.log('📝 Ahora los logs aparecerán en la consola de PostgreSQL');

  } catch (error) {
    console.error('❌ Error instalando trigger de debug:', error);
  } finally {
    if (client) client.release();
  }
}

installDebugLimpiarTrigger();