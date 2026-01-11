require('dotenv').config();
const { pool } = require('../config/database');

async function checkUser13() {
  let client;
  try {
    client = await pool.connect();

    const user = await client.query(`
      SELECT id, nombre, estado, activo, correo
      FROM usuarios
      WHERE id = 13
    `);

    if (user.rows.length > 0) {
      const u = user.rows[0];
      console.log(`👤 Usuario ID 13:`);
      console.log(`   Nombre: ${u.nombre}`);
      console.log(`   Estado: ${u.estado}`);
      console.log(`   Activo: ${u.activo}`);
      console.log(`   Correo: ${u.correo}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

checkUser13();