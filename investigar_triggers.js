// Investigar funciones de triggers
require('dotenv').config();
const { queryAsync } = require('./utils/queryAsync');

async function checkTriggers() {
  try {
    console.log('🔍 INVESTIGANDO FUNCIONES DE TRIGGERS...\n');

    // Ver las funciones de trigger
    const functions = await queryAsync(`
      SELECT proname, pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname IN ('sync_usuario_estado', 'limpiar_usuarios_eliminados')
    `);

    functions.forEach(func => {
      console.log(`📋 FUNCIÓN: ${func.proname}`);
      console.log(func.definition);
      console.log('---\n');
    });

    // Ver si hay algún problema con el usuario específico
    console.log('👤 DETALLES DEL USUARIO 13:');
    const userDetails = await queryAsync('SELECT * FROM usuarios WHERE id = 13');
    console.log(userDetails[0]);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTriggers();