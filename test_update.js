// Probar diferentes condiciones WHERE
require('dotenv').config();
const { queryAsync } = require('./utils/queryAsync');

async function testUpdate() {
  try {
    console.log('🔧 PROBANDO DIFERENTES CONDICIONES WHERE...\n');

    // Verificar que el usuario existe
    const exists = await queryAsync('SELECT id, estado FROM usuarios WHERE id = 13');
    console.log('Usuario existe:', exists);

    // Probar UPDATE con WHERE estado = 'bloqueado'
    console.log('\n🔄 Probando UPDATE con WHERE estado = bloqueado:');
    const updateEstado = await queryAsync("UPDATE usuarios SET estado = 'activo' WHERE estado = 'bloqueado'");
    console.log('Resultado:', updateEstado);

    // Verificar resultado
    const check = await queryAsync('SELECT id, estado FROM usuarios WHERE id = 13');
    console.log('Estado después:', check);

    // Resetear
    await queryAsync("UPDATE usuarios SET estado = 'bloqueado' WHERE id = 13");
    console.log('Reseteado a bloqueado');

    // Ahora probar el UPDATE específico que falla
    console.log('\n🔄 Probando UPDATE específico que falla:');
    const updateEspecifico = await queryAsync("UPDATE usuarios SET estado = 'activo' WHERE id = 13");
    console.log('Resultado del UPDATE específico:', updateEspecifico);

    const check2 = await queryAsync('SELECT id, estado FROM usuarios WHERE id = 13');
    console.log('Estado después del específico:', check2);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testUpdate();