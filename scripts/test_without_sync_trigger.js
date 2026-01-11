require('dotenv').config();
const { pool } = require('../config/database');

async function testWithoutSyncTrigger() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔧 DESACTIVANDO trigger sync_usuario_estado...\n');

    // Desactivar el trigger
    await client.query('ALTER TABLE usuarios DISABLE TRIGGER trigger_sync_estado');

    // Cambiar usuario a bloqueado primero
    console.log('1️⃣ Configurando usuario como bloqueado...');
    await client.query(`
      UPDATE usuarios
      SET estado = 'bloqueado', activo = false
      WHERE id = 13
    `);

    const blocked = await client.query(`
      SELECT estado, activo FROM usuarios WHERE id = 13
    `);
    console.log(`   Estado: ${blocked.rows[0].estado}, Activo: ${blocked.rows[0].activo}\n`);

    // Ahora intentar cambiar a activo
    console.log('2️⃣ Intentando cambiar a activo...');
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
    if (client) {
      // Reactivar el trigger
      try {
        await client.query('ALTER TABLE usuarios ENABLE TRIGGER trigger_sync_estado');
        console.log('\n🔄 Trigger sync_usuario_estado reactivado');
      } catch (e) {
        console.error('Error reactivando trigger:', e);
      }
      client.release();
    }
  }
}

testWithoutSyncTrigger();