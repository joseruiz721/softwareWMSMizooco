require('dotenv').config();
const { pool } = require('../config/database');

async function testBloqueadoToActivo() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔄 PROBANDO UPDATE de bloqueado a activo...\n');

    // Primero cambiar a bloqueado
    console.log('1️⃣ Cambiando a bloqueado...');
    await client.query(`
      UPDATE usuarios
      SET estado = 'bloqueado', activo = false
      WHERE id = 13
    `);

    // Verificar que está bloqueado
    const blocked = await client.query(`
      SELECT estado, activo FROM usuarios WHERE id = 13
    `);
    console.log(`   Estado después de bloqueo: ${blocked.rows[0].estado}, Activo: ${blocked.rows[0].activo}\n`);

    // Ahora intentar cambiar a activo
    console.log('2️⃣ Cambiando a activo...');
    const result = await client.query(`
      UPDATE usuarios
      SET estado = 'activo', activo = true
      WHERE id = 13
    `);

    console.log(`📊 Filas afectadas: ${result.rowCount}\n`);

    // Verificar resultado
    const after = await client.query(`
      SELECT estado, activo FROM usuarios WHERE id = 13
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

testBloqueadoToActivo();