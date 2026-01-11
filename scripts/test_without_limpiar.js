require('dotenv').config();
const { pool } = require('../config/database');

async function testWithoutLimpiarTrigger() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔧 DESACTIVANDO TRIGGER limpiar_usuarios_eliminados TEMPORALMENTE...\n');

    // Desactivar el trigger problemático
    await client.query('ALTER TABLE usuarios DISABLE TRIGGER trigger_limpiar_eliminados');

    console.log('✅ Trigger desactivado\n');

    // Verificar estado actual de un usuario de prueba
    const userBefore = await client.query(`
      SELECT id, nombre, estado, activo
      FROM usuarios
      WHERE estado = 'bloqueado'
      LIMIT 1
    `);

    if (userBefore.rows.length === 0) {
      console.log('❌ No hay usuarios bloqueados para probar');
      return;
    }

    const testUser = userBefore.rows[0];
    console.log(`👤 Usuario de prueba: ${testUser.nombre} (ID: ${testUser.id})`);
    console.log(`   Estado actual: ${testUser.estado}, Activo: ${testUser.activo}\n`);

    // Intentar cambiar el estado a 'activo'
    console.log('🔄 Intentando cambiar estado a "activo"...');
    const updateResult = await client.query(`
      UPDATE usuarios
      SET estado = 'activo', activo = true
      WHERE id = $1
    `, [testUser.id]);

    console.log(`📊 Resultado del UPDATE: ${updateResult.rowCount} filas afectadas\n`);

    // Verificar el estado después del update
    const userAfter = await client.query(`
      SELECT id, nombre, estado, activo
      FROM usuarios
      WHERE id = $1
    `, [testUser.id]);

    const userAfterData = userAfter.rows[0];
    console.log(`✅ Estado después del UPDATE:`);
    console.log(`   Estado: ${userAfterData.estado}, Activo: ${userAfterData.activo}`);

    const success = userAfterData.estado === 'activo' && userAfterData.activo === true;
    console.log(`🎯 ¿Cambio exitoso?: ${success ? 'SÍ' : 'NO'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) {
      // Reactivar el trigger
      try {
        await client.query('ALTER TABLE usuarios ENABLE TRIGGER trigger_limpiar_eliminados');
        console.log('\n🔄 Trigger reactivado');
      } catch (e) {
        console.error('Error reactivando trigger:', e);
      }
      client.release();
    }
  }
}

testWithoutLimpiarTrigger();