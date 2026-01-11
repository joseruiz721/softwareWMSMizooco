// Script para diagnosticar problemas de base de datos
require('dotenv').config();
const { queryAsync } = require('./utils/queryAsync');

async function diagnosticarBD() {
    try {
        console.log('🔍 DIAGNOSTICANDO BASE DE DATOS...\n');

        // 1. Verificar tablas
        console.log('📋 TABLAS EXISTENTES:');
        const tablas = await queryAsync(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
        `);
        tablas.forEach(t => console.log(`  - ${t.tablename}`));

        // 2. Verificar triggers en tabla usuarios
        console.log('\n🎯 TRIGGERS EN TABLA USUARIOS:');
        const triggers = await queryAsync(`
            SELECT trigger_name, event_manipulation, action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'usuarios';
        `);
        if (triggers.length === 0) {
            console.log('  - No hay triggers en la tabla usuarios');
        } else {
            triggers.forEach(t => console.log(`  - ${t.trigger_name}: ${t.event_manipulation} -> ${t.action_statement}`));
        }

        // 3. Verificar constraints en tabla usuarios
        console.log('\n🔒 CONSTRAINTS EN TABLA USUARIOS:');
        const constraints = await queryAsync(`
            SELECT conname, contype, conrelid::regclass, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'usuarios'::regclass;
        `);
        if (constraints.length === 0) {
            console.log('  - No hay constraints especiales en la tabla usuarios');
        } else {
            constraints.forEach(c => console.log(`  - ${c.conname} (${c.contype}): ${c.pg_get_constraintdef}`));
        }

        // 4. Verificar estado actual de usuarios
        console.log('\n👥 ESTADO ACTUAL DE USUARIOS:');
        const usuarios = await queryAsync('SELECT id, nombre, estado FROM usuarios ORDER BY id;');
        usuarios.forEach(u => console.log(`  - ID ${u.id}: ${u.nombre} -> ${u.estado}`));

        // 5. Probar una actualización simple
        console.log('\n🔧 PROBANDO ACTUALIZACIÓN SIMPLE:');
        console.log('  - Estado antes:', usuarios.find(u => u.id === 13)?.estado);

        await queryAsync('UPDATE usuarios SET estado = $1 WHERE id = $2', ['activo', 13]);

        const despues = await queryAsync('SELECT estado FROM usuarios WHERE id = $1', [13]);
        console.log('  - Estado después:', despues[0]?.estado);

        if (despues[0]?.estado === 'activo') {
            console.log('  ✅ Actualización exitosa');
        } else {
            console.log('  ❌ Actualización falló');
        }

        // 6. Verificar si hay transacciones activas
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

diagnosticarBD();