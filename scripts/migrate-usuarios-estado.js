// Archivo: migrations/migrate-usuarios-estado.js
const { queryAsync } = require('../utils/queryAsync');

async function migrateUsuariosEstado() {
    console.log('🚀 Iniciando migración de tabla usuarios...');
    
    try {
        // 1. Verificar si la columna 'estado' ya existe
        const checkEstado = await queryAsync(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'estado'
        `);
        
        if (checkEstado.length === 0) {
            console.log('📝 Agregando columna "estado"...');
            
            // Agregar columna estado
            await queryAsync(`
                ALTER TABLE usuarios 
                ADD COLUMN estado VARCHAR(20) DEFAULT 'activo'
            `);
            
            console.log('✅ Columna "estado" agregada');
        } else {
            console.log('✅ Columna "estado" ya existe');
        }
        
        // 2. Verificar si la columna 'fecha_expiracion_suspension' existe
        const checkFechaExpiracion = await queryAsync(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'fecha_expiracion_suspension'
        `);
        
        if (checkFechaExpiracion.length === 0) {
            console.log('📝 Agregando columna "fecha_expiracion_suspension"...');
            
            await queryAsync(`
                ALTER TABLE usuarios 
                ADD COLUMN fecha_expiracion_suspension TIMESTAMP NULL
            `);
            
            console.log('✅ Columna "fecha_expiracion_suspension" agregada');
        } else {
            console.log('✅ Columna "fecha_expiracion_suspension" ya existe');
        }
        
        // 3. Verificar si la columna 'fecha_bloqueo' existe
        const checkFechaBloqueo = await queryAsync(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'fecha_bloqueo'
        `);
        
        if (checkFechaBloqueo.length === 0) {
            console.log('📝 Agregando columna "fecha_bloqueo"...');
            
            await queryAsync(`
                ALTER TABLE usuarios 
                ADD COLUMN fecha_bloqueo TIMESTAMP NULL
            `);
            
            console.log('✅ Columna "fecha_bloqueo" agregada');
        } else {
            console.log('✅ Columna "fecha_bloqueo" ya existe');
        }
        
        // 4. Actualizar valores por defecto si es necesario
        console.log('🔄 Actualizando valores por defecto...');
        
        await queryAsync(`
            UPDATE usuarios 
            SET estado = 'activo' 
            WHERE estado IS NULL OR estado = ''
        `);
        
        await queryAsync(`
            UPDATE usuarios 
            SET activo = true 
            WHERE estado = 'activo' AND (activo = false OR activo IS NULL)
        `);
        
        await queryAsync(`
            UPDATE usuarios 
            SET activo = false 
            WHERE estado != 'activo' AND activo = true
        `);
        
        console.log('✅ Valores por defecto actualizados');
        
        // 5. Crear tabla de historial si no existe
        console.log('📝 Verificando tabla "historial_estados"...');
        
        try {
            await queryAsync(`
                CREATE TABLE IF NOT EXISTS historial_estados (
                    id SERIAL PRIMARY KEY,
                    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    estado_anterior VARCHAR(20),
                    estado_nuevo VARCHAR(20) NOT NULL,
                    motivo TEXT,
                    administrador_id INTEGER REFERENCES usuarios(id),
                    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            console.log('✅ Tabla "historial_estados" creada/verificada');
            
            // Crear índices
            await queryAsync(`
                CREATE INDEX IF NOT EXISTS idx_historial_usuario ON historial_estados(usuario_id)
            `);
            
            await queryAsync(`
                CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_estados(fecha)
            `);
            
            console.log('✅ Índices creados');
            
        } catch (error) {
            console.log('⚠️ No se pudo crear la tabla de historial:', error.message);
        }
        
        // 6. Mostrar resumen
        const resumen = await queryAsync(`
            SELECT 
                estado,
                COUNT(*) as cantidad,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje
            FROM usuarios 
            GROUP BY estado
            ORDER BY estado
        `);
        
        console.log('\n📊 Resumen de estados de usuarios:');
        console.log('================================');
        resumen.forEach(row => {
            console.log(`${row.estado}: ${row.cantidad} usuarios (${row.porcentaje}%)`);
        });
        
        const total = await queryAsync('SELECT COUNT(*) as total FROM usuarios');
        console.log(`\n📈 Total de usuarios: ${total[0].total}`);
        
        console.log('\n🎉 Migración completada exitosamente!');
        return { success: true, message: 'Migración completada' };
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
        return { success: false, message: error.message };
    }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
    migrateUsuariosEstado()
        .then(result => {
            if (result.success) {
                console.log('✅ Migración finalizada');
                process.exit(0);
            } else {
                console.error('❌ Migración fallida:', result.message);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Error crítico:', error);
            process.exit(1);
        });
}

module.exports = { migrateUsuariosEstado };