// scripts/reset-migration.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'control_acceso',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false
});

async function resetMigration() {
    console.log('🔄 Iniciando reversión de migración...');
    console.log('⚠️  ADVERTENCIA: Esta operación eliminará las columnas agregadas');
    
    const confirmation = process.argv.includes('--force');
    
    if (!confirmation) {
        console.log('\n❌ Ejecuta con --force para confirmar: npm run db:reset -- --force');
        console.log('   Ejemplo: node scripts/reset-migration.js --force');
        return { success: false, message: 'Confirmación requerida' };
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('\n1. Eliminando tabla historial_estados...');
        try {
            await client.query('DROP TABLE IF EXISTS historial_estados CASCADE');
            console.log('   ✅ Tabla historial_estados eliminada');
        } catch (error) {
            console.log('   ⚠️  No se pudo eliminar historial_estados:', error.message);
        }
        
        console.log('\n2. Eliminando índices...');
        try {
            await client.query('DROP INDEX IF EXISTS idx_usuarios_estado_activo');
            console.log('   ✅ Índice idx_usuarios_estado_activo eliminado');
        } catch (error) {
            console.log('   ⚠️  No se pudo eliminar índice:', error.message);
        }
        
        try {
            await client.query('DROP INDEX IF EXISTS idx_usuarios_estado');
            console.log('   ✅ Índice idx_usuarios_estado eliminado');
        } catch (error) {
            console.log('   ⚠️  No se pudo eliminar índice:', error.message);
        }
        
        console.log('\n3. Eliminando constraint...');
        try {
            await client.query('ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_estado');
            console.log('   ✅ Constraint chk_estado eliminado');
        } catch (error) {
            console.log('   ⚠️  No se pudo eliminar constraint:', error.message);
        }
        
        console.log('\n4. Eliminando columnas...');
        try {
            await client.query('ALTER TABLE usuarios DROP COLUMN IF EXISTS fecha_bloqueo');
            console.log('   ✅ Columna fecha_bloqueo eliminada');
        } catch (error) {
            console.log('   ⚠️  No se pudo eliminar columna:', error.message);
        }
        
        try {
            await client.query('ALTER TABLE usuarios DROP COLUMN IF EXISTS fecha_expiracion_suspension');
            console.log('   ✅ Columna fecha_expiracion_suspension eliminada');
        } catch (error) {
            console.log('   ⚠️  No se pudo eliminar columna:', error.message);
        }
        
        try {
            await client.query('ALTER TABLE usuarios DROP COLUMN IF EXISTS estado');
            console.log('   ✅ Columna estado eliminada');
        } catch (error) {
            console.log('   ⚠️  No se pudo eliminar columna:', error.message);
        }
        
        console.log('\n5. Restaurando columna activo...');
        try {
            // Si quieres restaurar todos los usuarios a activos
            await client.query('UPDATE usuarios SET activo = true WHERE activo IS NULL OR activo = false');
            console.log('   ✅ Columna activo restaurada a true para todos');
        } catch (error) {
            console.log('   ⚠️  No se pudo restaurar columna activo:', error.message);
        }
        
        await client.query('COMMIT');
        
        console.log('\n✅ Reversión completada');
        console.log('⚠️  Nota: Los datos de estado se han perdido permanentemente');
        
        return { success: true, message: 'Reversión completada' };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error en reversión:', error.message);
        return { success: false, message: error.message };
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    resetMigration()
        .then(result => {
            if (result.success) {
                console.log('\n✅ Reversión finalizada');
                process.exit(0);
            } else {
                console.error('\n❌ Reversión fallida:', result.message);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 Error crítico:', error);
            process.exit(1);
        });
}

module.exports = { resetMigration };