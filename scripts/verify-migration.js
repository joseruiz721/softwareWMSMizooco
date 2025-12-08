// scripts/verify-migration.js
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

async function verifyMigration() {
    console.log('🔍 Verificando migración de tabla usuarios...');
    console.log(`📊 Conectando a: ${process.env.DB_NAME || 'control_acceso'}`);
    
    const client = await pool.connect();
    
    try {
        // 1. Verificar estructura de columnas
        console.log('\n1. Verificando estructura de columnas:');
        console.log('=====================================');
        
        const columns = await client.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'usuarios'
                AND column_name IN ('estado', 'activo', 'fecha_expiracion_suspension', 'fecha_bloqueo')
            ORDER BY column_name
        `);
        
        if (columns.rows.length === 0) {
            console.log('   ❌ No se encontraron las columnas migradas');
        } else {
            columns.rows.forEach(col => {
                console.log(`   📋 ${col.column_name}:`);
                console.log(`     Tipo: ${col.data_type}`);
                console.log(`     Nulo: ${col.is_nullable}`);
                console.log(`     Default: ${col.column_default || 'Ninguno'}`);
            });
        }
        
        // 2. Verificar constraints
        console.log('\n2. Verificando constraints:');
        console.log('=========================');
        
        const constraints = await client.query(`
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'usuarios'
                AND tc.constraint_name = 'chk_estado'
        `);
        
        if (constraints.rows.length === 0) {
            console.log('   ❌ Constraint chk_estado no encontrado');
        } else {
            constraints.rows.forEach(con => {
                console.log(`   ✅ ${con.constraint_name} (${con.constraint_type}) en columna ${con.column_name}`);
            });
        }
        
        // 3. Verificar índices
        console.log('\n3. Verificando índices:');
        console.log('======================');
        
        const indexes = await client.query(`
            SELECT 
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE tablename = 'usuarios'
                AND indexname IN ('idx_usuarios_estado', 'idx_usuarios_estado_activo')
            ORDER BY indexname
        `);
        
        if (indexes.rows.length === 0) {
            console.log('   ⚠️  No se encontraron índices');
        } else {
            indexes.rows.forEach(idx => {
                console.log(`   ✅ ${idx.indexname}`);
            });
        }
        
        // 4. Verificar distribución de datos
        console.log('\n4. Verificando distribución de datos:');
        console.log('====================================');
        
        const distribution = await client.query(`
            SELECT 
                estado,
                COUNT(*) as cantidad,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM usuarios), 2) as porcentaje
            FROM usuarios 
            GROUP BY estado 
            ORDER BY estado
        `);
        
        console.log('   📊 Distribución por estado:');
        distribution.rows.forEach(row => {
            console.log(`     ${row.estado || 'NULL'}: ${row.cantidad} (${row.porcentaje}%)`);
        });
        
        // 5. Verificar sincronización
        console.log('\n5. Verificando sincronización estado/activo:');
        console.log('==========================================');
        
        const sync = await client.query(`
            SELECT 
                CASE 
                    WHEN activo = true AND estado = 'activo' THEN '✅ Sincronizado (activo)'
                    WHEN activo = false AND estado != 'activo' THEN '✅ Sincronizado (inactivo)'
                    ELSE '❌ Desincronizado'
                END as estado_sync,
                COUNT(*) as cantidad
            FROM usuarios 
            GROUP BY 
                CASE 
                    WHEN activo = true AND estado = 'activo' THEN '✅ Sincronizado (activo)'
                    WHEN activo = false AND estado != 'activo' THEN '✅ Sincronizado (inactivo)'
                    ELSE '❌ Desincronizado'
                END
            ORDER BY estado_sync
        `);
        
        sync.rows.forEach(row => {
            console.log(`   ${row.estado_sync}: ${row.cantidad}`);
        });
        
        // 6. Verificar tabla de historial
        console.log('\n6. Verificando tabla historial_estados:');
        console.log('=====================================');
        
        try {
            const historial = await client.query(`
                SELECT 
                    COUNT(*) as total_registros
                FROM historial_estados
            `);
            console.log(`   📋 Tabla existe con ${historial.rows[0].total_registros} registros`);
        } catch (error) {
            console.log('   ⚠️  Tabla historial_estados no existe');
        }
        
        // 7. Resumen de verificación
        console.log('\n📋 RESUMEN DE VERIFICACIÓN:');
        console.log('==========================');
        
        const columnCount = columns.rows.length;
        const constraintCount = constraints.rows.length;
        const indexCount = indexes.rows.length;
        
        console.log(`   Columnas migradas: ${columnCount}/4 ${columnCount === 4 ? '✅' : '❌'}`);
        console.log(`   Constraints: ${constraintCount}/1 ${constraintCount === 1 ? '✅' : '❌'}`);
        console.log(`   Índices: ${indexCount}/2 ${indexCount === 2 ? '✅' : '❌'}`);
        
        const totalSync = sync.rows.find(r => r.estado_sync.includes('Sincronizado'))?.cantidad || 0;
        const totalUsers = distribution.rows.reduce((sum, row) => sum + parseInt(row.cantidad), 0);
        const syncPercentage = totalUsers > 0 ? Math.round((totalSync / totalUsers) * 100) : 0;
        
        console.log(`   Sincronización: ${syncPercentage}% ${syncPercentage === 100 ? '✅' : '⚠️'}`);
        
        if (columnCount === 4 && constraintCount === 1 && indexCount >= 1 && syncPercentage === 100) {
            console.log('\n🎉 ¡Migración verificada exitosamente!');
            return { success: true, verified: true };
        } else {
            console.log('\n⚠️  Verificación completada con advertencias');
            return { success: true, verified: false, warnings: true };
        }
        
    } catch (error) {
        console.error('\n❌ Error en verificación:', error.message);
        return { success: false, message: error.message };
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar verificación si se llama directamente
if (require.main === module) {
    verifyMigration()
        .then(result => {
            if (result.success) {
                if (result.verified) {
                    console.log('\n✅ Verificación exitosa');
                    process.exit(0);
                } else {
                    console.log('\n⚠️  Verificación con advertencias');
                    process.exit(2);
                }
            } else {
                console.error('\n❌ Verificación fallida:', result.message);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 Error crítico:', error);
            process.exit(1);
        });
}

module.exports = { verifyMigration };