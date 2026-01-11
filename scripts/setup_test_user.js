require('dotenv').config();
const { pool } = require('../config/database');

async function setupTestUser() {
  let client;
  try {
    client = await pool.connect();

    // Buscar un usuario activo que no sea admin
    const user = await client.query(`
      SELECT id, nombre, estado, activo, role
      FROM usuarios
      WHERE estado = 'activo' AND role != 'admin'
      LIMIT 1
    `);

    if (user.rows.length === 0) {
      console.log('❌ No hay usuarios activos no-admin para probar');
      return;
    }

    const testUser = user.rows[0];
    console.log(`👤 Usuario encontrado: ${testUser.nombre} (ID: ${testUser.id}, Role: ${testUser.role})`);

    // Cambiar a bloqueado para la prueba
    await client.query(`
      UPDATE usuarios
      SET estado = 'bloqueado', activo = false
      WHERE id = ${testUser.id}
    `);

    console.log('✅ Usuario configurado como bloqueado para prueba');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

setupTestUser();