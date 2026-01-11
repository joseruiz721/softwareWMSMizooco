// Probar UPDATE con conexión directa del pool
require('dotenv').config();
const { pool } = require('./config/database');

async function testDirectUpdate() {
  let client;
  try {
    console.log('🔧 PROBANDO UPDATE CON CONEXIÓN DIRECTA...\n');

    // Obtener cliente del pool
    client = await pool.connect();

    // Iniciar transacción
    await client.query('BEGIN');
    console.log('Transacción iniciada');

    // Verificar estado inicial
    const inicial = await client.query('SELECT id, estado, activo FROM usuarios WHERE id = 13');
    console.log('Estado inicial:', inicial.rows[0]);

    // Ejecutar UPDATE
    const updateResult = await client.query('UPDATE usuarios SET estado = $1 WHERE id = $2', ['activo', 13]);
    console.log('Resultado del UPDATE:', {
      rowCount: updateResult.rowCount,
      command: updateResult.command,
      rows: updateResult.rows
    });

    // Verificar estado dentro de la transacción
    const dentro = await client.query('SELECT id, estado, activo FROM usuarios WHERE id = 13');
    console.log('Estado dentro de transacción:', dentro.rows[0]);

    // Confirmar transacción
    await client.query('COMMIT');
    console.log('Transacción confirmada');

    // Verificar estado final
    const final = await client.query('SELECT id, estado, activo FROM usuarios WHERE id = 13');
    console.log('Estado final:', final.rows[0]);

    // Resetear
    await client.query('UPDATE usuarios SET estado = $1 WHERE id = $2', ['bloqueado', 13]);
    await client.query('COMMIT');
    console.log('Reseteado a bloqueado');

  } catch (error) {
    console.error('❌ Error:', error);
    if (client) {
      await client.query('ROLLBACK');
      console.log('Transacción revertida');
    }
  } finally {
    if (client) {
      client.release();
    }
  }
}

testDirectUpdate();