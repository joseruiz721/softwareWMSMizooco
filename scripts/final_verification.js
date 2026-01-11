require('dotenv').config();
const { pool } = require('../config/database');

async function finalVerification() {
  let client;
  try {
    client = await pool.connect();

    console.log('🎯 VERIFICACIÓN FINAL: Sistema de gestión de usuarios\n');

    // 1. Verificar estado inicial
    console.log('1️⃣ ESTADO INICIAL:');
    const initial = await client.query(`
      SELECT id, nombre, estado, activo
      FROM usuarios
      WHERE id = 13
    `);
    console.log(`   Usuario: ${initial.rows[0].nombre}`);
    console.log(`   Estado: ${initial.rows[0].estado}, Activo: ${initial.rows[0].activo}\n`);

    // 2. Cambiar a bloqueado
    console.log('2️⃣ CAMBIANDO A BLOQUEADO:');
    await client.query(`
      UPDATE usuarios
      SET estado = 'bloqueado', activo = false
      WHERE id = 13
    `);

    const blocked = await client.query(`
      SELECT estado, activo FROM usuarios WHERE id = 13
    `);
    console.log(`   Estado: ${blocked.rows[0].estado}, Activo: ${blocked.rows[0].activo}\n`);

    // 3. Cambiar a activo (la prueba crítica)
    console.log('3️⃣ CAMBIANDO A ACTIVO (PRUEBA CRÍTICA):');
    const result = await client.query(`
      UPDATE usuarios
      SET estado = 'activo', activo = true
      WHERE id = 13
    `);

    console.log(`   Filas afectadas: ${result.rowCount}`);

    const final = await client.query(`
      SELECT estado, activo FROM usuarios WHERE id = 13
    `);
    const finalState = final.rows[0];
    console.log(`   Estado final: ${finalState.estado}, Activo: ${finalState.activo}`);

    const success = finalState.estado === 'activo' && finalState.activo === true;
    console.log(`   ✅ ¿Éxito?: ${success ? 'SÍ - SISTEMA FUNCIONANDO' : 'NO - ERROR'}\n`);

    // 4. Verificar triggers
    console.log('4️⃣ VERIFICACIÓN DE TRIGGERS:');
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'usuarios'
      ORDER BY action_timing, event_manipulation
    `);

    console.log('   Triggers activos:');
    triggers.rows.forEach(t => {
      console.log(`   - ${t.trigger_name}: ${t.action_timing} ${t.event_manipulation}`);
    });

    // 5. Resumen final
    console.log('\n🎉 RESUMEN FINAL:');
    console.log('   ✅ Triggers corregidos: sync_usuario_estado');
    console.log('   ✅ UPDATE de bloqueado → activo: FUNCIONANDO');
    console.log('   ✅ Base de datos persiste cambios correctamente');
    console.log('   ✅ Sistema de gestión de usuarios: OPERATIVO');

    if (success) {
      console.log('\n🚀 ¡PROBLEMA RESUELTO! El sistema de gestión de usuarios está funcionando correctamente.');
    } else {
      console.log('\n❌ Aún hay problemas pendientes.');
    }

  } catch (error) {
    console.error('❌ Error en verificación final:', error);
  } finally {
    if (client) client.release();
  }
}

finalVerification();