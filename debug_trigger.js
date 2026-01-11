// Debugging del trigger
require('dotenv').config();
const { pool } = require('./config/database');

async function debugTrigger() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔧 DEBUGGING TRIGGER STEP BY STEP...\n');

    // Ver estado inicial
    const inicial = await client.query('SELECT id, estado, activo FROM usuarios WHERE id = 13');
    console.log('Estado inicial:', inicial.rows[0]);

    // Simular lo que hace el trigger
    console.log('\n🎯 SIMULANDO TRIGGER MANUALMENTE:');
    console.log('OLD.estado = "bloqueado", OLD.activo = false');
    console.log('NEW.estado = "activo", NEW.activo = ???');

    // Paso 1: Si estado cambia a activo, activo = true
    console.log('Paso 1 - Estado cambió a activo: NEW.activo = true');

    // Paso 2: Si activo cambió de false a true, estado = activo
    console.log('Paso 2 - Activo cambió de false a true: NEW.estado = "activo"');
    console.log('Resultado final: NEW.estado = "activo", NEW.activo = true');

    // Ahora ejecutar UPDATE con trigger habilitado
    console.log('\n🔄 EJECUTANDO UPDATE CON TRIGGER:');
    const update = await client.query('UPDATE usuarios SET estado = $1 WHERE id = $2', ['activo', 13]);
    console.log('Update result:', { rowCount: update.rowCount, command: update.command });

    // Ver qué cambió realmente
    const despues = await client.query('SELECT id, estado, activo FROM usuarios WHERE id = 13');
    console.log('Estado después:', despues.rows[0]);

    // Reset
    await client.query('UPDATE usuarios SET estado = $1 WHERE id = $2', ['bloqueado', 13]);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

debugTrigger();