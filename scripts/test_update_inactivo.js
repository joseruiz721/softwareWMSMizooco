require('dotenv').config();
const { pool } = require('../config/database');

async function testUpdateInactivo() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔄 PROBANDO UPDATE de inactivo a activo...\n');

    // Verificar estado inicial
    const before = await client.query(`
      SELECT id, nombre, estado, activo
      FROM usuarios
      WHERE id = 13
    `);

    const user = before.rows[0];
    console.log(`👤 Estado inicial: ${user.estado}, Activo: ${user.activo}\n`);

    // Hacer el UPDATE
    console.log('⚡ Ejecutando UPDATE a activo...');
    const result = await client.query(`
      UPDATE usuarios
      SET estado = 'activo', activo = true
      WHERE id = 13
    `);

    console.log(`📊 Filas afectadas: ${result.rowCount}\n`);

    // Verificar resultado
    const after = await client.query(`
      SELECT id, nombre, estado, activo
      FROM usuarios
      WHERE id = 13
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

testUpdateInactivo();