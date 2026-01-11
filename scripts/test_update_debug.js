require('dotenv').config();
const { pool } = require('../config/database');

async function testUpdateWithDebug() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔄 PROBANDO UPDATE CON TRIGGERS DE DEBUG...\n');

    // Buscar un usuario bloqueado
    const user = await client.query(`
      SELECT id, nombre, estado, activo
      FROM usuarios
      WHERE estado = 'bloqueado'
      LIMIT 1
    `);

    if (user.rows.length === 0) {
      console.log('❌ No hay usuarios bloqueados');
      return;
    }

    const testUser = user.rows[0];
    console.log(`👤 Usuario: ${testUser.nombre} (ID: ${testUser.id})`);
    console.log(`   Estado actual: ${testUser.estado}, Activo: ${testUser.activo}\n`);

    // Hacer el UPDATE
    console.log('⚡ Ejecutando UPDATE...');
    const result = await client.query(`
      UPDATE usuarios
      SET estado = 'activo', activo = true
      WHERE id = ${testUser.id}
    `);

    console.log(`📊 Filas afectadas: ${result.rowCount}\n`);

    // Verificar resultado
    const after = await client.query(`
      SELECT id, nombre, estado, activo
      FROM usuarios
      WHERE id = ${testUser.id}
    `);

    const afterUser = after.rows[0];
    console.log(`✅ Estado final: ${afterUser.estado}, Activo: ${afterUser.activo}`);
    console.log(`🎯 Éxito: ${afterUser.estado === 'activo' ? 'SÍ' : 'NO'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

testUpdateWithDebug();