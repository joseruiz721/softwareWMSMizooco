// Probar UPDATE sin trigger
require('dotenv').config();
const { queryAsync } = require('./utils/queryAsync');

async function testWithoutTrigger() {
  try {
    console.log('🔧 PROBANDO UPDATE SIN TRIGGER...\n');

    // Deshabilitar trigger temporalmente
    await queryAsync('ALTER TABLE usuarios DISABLE TRIGGER trigger_sync_estado');
    console.log('Trigger deshabilitado');

    // Probar UPDATE
    const update = await queryAsync("UPDATE usuarios SET estado = 'activo' WHERE id = 13");
    console.log('UPDATE sin trigger:', update);

    // Verificar
    const check = await queryAsync('SELECT id, estado, activo FROM usuarios WHERE id = 13');
    console.log('Estado después:', check);

    // Resetear
    await queryAsync("UPDATE usuarios SET estado = 'bloqueado' WHERE id = 13");
    console.log('Reseteado');

    // Re-habilitar trigger
    await queryAsync('ALTER TABLE usuarios ENABLE TRIGGER trigger_sync_estado');
    console.log('Trigger re-habilitado');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWithoutTrigger();