require('dotenv').config();
const { pool } = require('../config/database');

async function setupUserForAPITest() {
  let client;
  try {
    client = await pool.connect();

    // Configurar usuario como bloqueado para la prueba
    await client.query(`
      UPDATE usuarios
      SET estado = 'bloqueado', activo = false
      WHERE id = 13
    `);

    const user = await client.query(`
      SELECT id, nombre, estado, activo
      FROM usuarios
      WHERE id = 13
    `);

    console.log('👤 Usuario configurado para prueba API:');
    console.log(`   ID: ${user.rows[0].id}`);
    console.log(`   Nombre: ${user.rows[0].nombre}`);
    console.log(`   Estado: ${user.rows[0].estado}`);
    console.log(`   Activo: ${user.rows[0].activo}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

setupUserForAPITest();