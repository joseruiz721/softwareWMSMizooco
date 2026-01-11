require('dotenv').config();
const { pool } = require('../config/database');

async function examineLimpiarTrigger() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔍 EXAMINANDO TRIGGER limpiar_usuarios_eliminados...\n');

    const functionDef = await client.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'limpiar_usuarios_eliminados'
    `);

    if (functionDef.rows.length > 0) {
      console.log('📄 DEFINICIÓN DE LA FUNCIÓN:');
      console.log(functionDef.rows[0].definition);
    } else {
      console.log('❌ Función no encontrada');
    }

    // Verificar si hay algún usuario con estado 'eliminado'
    const deletedUsers = await client.query(`
      SELECT id, nombre, correo, estado, eliminado
      FROM usuarios
      WHERE eliminado = true OR estado = 'eliminado'
      LIMIT 5
    `);

    console.log(`\n👤 USUARIOS ELIMINADOS: ${deletedUsers.rows.length}`);
    deletedUsers.rows.forEach(u => {
      console.log(`  - ID: ${u.id}, Nombre: ${u.nombre}, Estado: ${u.estado}, Eliminado: ${u.eliminado}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

examineLimpiarTrigger();