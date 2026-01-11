// Script de diagnóstico completo para la tabla usuarios
require('dotenv').config(); // Cargar variables de entorno

const { queryAsync } = require('./utils/queryAsync');

async function diagnosticarTablaUsuarios() {
    try {
        console.log('🔍 DIAGNOSTICANDO TABLA USUARIOS...\n');

        // 1. Verificar esquema de la tabla
        console.log('📋 ESQUEMA DE LA TABLA USUARIOS:');
        const esquema = await queryAsync(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'usuarios'
            ORDER BY ordinal_position;
        `);
        esquema.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `default: ${col.column_default}` : ''}`);
        });

        // 2. Verificar triggers
        console.log('\n🎯 TRIGGERS EN TABLA USUARIOS:');
        const triggers = await queryAsync(`
            SELECT trigger_name, event_manipulation, action_statement, action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'usuarios';
        `);
        if (triggers.length === 0) {
            console.log('  - No hay triggers');
        } else {
            triggers.forEach(t => console.log(`  - ${t.trigger_name}: ${t.action_timing} ${t.event_manipulation} -> ${t.action_statement.substring(0, 100)}...`));
        }

        // 3. Verificar constraints
        console.log('\n🔒 CONSTRAINTS EN TABLA USUARIOS:');
        const constraints = await queryAsync(`
            SELECT conname, contype, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'usuarios'::regclass;
        `);
        if (constraints.length === 0) {
            console.log('  - No hay constraints especiales');
        } else {
            constraints.forEach(c => console.log(`  - ${c.conname} (${c.contype}): ${c.definition}`));
        }

        // 4. Verificar índices
        console.log('\n📊 ÍNDICES EN TABLA USUARIOS:');
        const indices = await queryAsync(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'usuarios';
        `);
        indices.forEach(i => console.log(`  - ${i.indexname}: ${i.indexdef}`));

        // 5. Verificar datos actuales
        console.log('\n👥 DATOS ACTUALES DE USUARIOS:');
        const usuarios = await queryAsync('SELECT id, nombre, estado FROM usuarios ORDER BY id;');
        usuarios.forEach(u => console.log(`  - ID ${u.id} (${typeof u.id}): ${u.nombre} -> ${u.estado}`));

        // 6. Probar UPDATE directo
        console.log('\n🔧 PROBANDO UPDATE DIRECTO:');
        console.log('  - Usuario 13 antes:', usuarios.find(u => u.id === 13)?.estado);

        // Usar queryAsync para el UPDATE
        const updateResult = await queryAsync(
            "UPDATE usuarios SET estado = $1 WHERE id = $2",
            ['activo', 13]
        );
        console.log('  - Resultado del UPDATE:', updateResult);

        // Verificar después
        const despues = await queryAsync('SELECT estado FROM usuarios WHERE id = $1', [13]);
        console.log('  - Usuario 13 después:', despues[0]?.estado);

        // 7. Probar con diferentes tipos de ID
        console.log('\n🔄 PROBANDO CON ID COMO STRING:');
        const updateResult2 = await queryAsync(
            "UPDATE usuarios SET estado = $1 WHERE id = $2",
            ['bloqueado', '13']  // ID como string
        );
        console.log('  - Resultado con ID string:', updateResult2);

        const despues2 = await queryAsync('SELECT estado FROM usuarios WHERE id = $1', [13]);
        console.log('  - Usuario 13 después de string:', despues2[0]?.estado);

        // 8. Verificar si hay transacciones activas
        console.log('\n🔄 TRANSACCIONES ACTIVAS:');
        const transacciones = await queryAsync(`
            SELECT pid, state, query
            FROM pg_stat_activity
            WHERE state = 'active' AND pid <> pg_backend_pid();
        `);
        if (transacciones.length === 0) {
            console.log('  - No hay transacciones activas');
        } else {
            transacciones.forEach(t => console.log(`  - PID ${t.pid}: ${t.state} - ${t.query.substring(0, 50)}...`));
        }

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
}

diagnosticarTablaUsuarios();