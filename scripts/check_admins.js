require('dotenv').config();
const { pool } = require('../config/database');

async function checkAdminUsers() {
  let client;
  try {
    client = await pool.connect();

    const admins = await client.query(`
      SELECT id, nombre, correo, role, estado, activo
      FROM usuarios
      WHERE role = 'admin'
    `);

    console.log('👑 USUARIOS ADMIN:');
    admins.rows.forEach(admin => {
      console.log(`  - ${admin.nombre} (${admin.correo}) - Estado: ${admin.estado}, Activo: ${admin.activo}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

checkAdminUsers();