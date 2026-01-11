require('dotenv').config();
const { pool } = require('../config/database');

async function checkColumns() {
  let client;
  try {
    client = await pool.connect();
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position
    `);
    console.log('📋 COLUMNAS DE LA TABLA USUARIOS:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) client.release();
  }
}

checkColumns();