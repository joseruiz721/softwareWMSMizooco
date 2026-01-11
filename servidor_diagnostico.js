// Servidor de diagnóstico simple para probar la actualización de usuarios
const express = require('express');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'control_acceso',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

const queryAsync = (text, params) => {
    return new Promise((resolve, reject) => {
        pool.query(text, params, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.rows);
            }
        });
    });
};

const app = express();
app.use(express.json());

app.post('/test-update', async (req, res) => {
    try {
        const { id, estado } = req.body;

        console.log(`\n🔧 DIAGNÓSTICO: Probando UPDATE de usuario ${id} a estado: ${estado}`);

        // Verificar estado ANTES
        const antes = await queryAsync('SELECT estado FROM usuarios WHERE id = $1', [id]);
        console.log(`📊 Estado ANTES: ${antes[0]?.estado}`);

        // Verificar esquema
        const esquema = await queryAsync(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'usuarios' AND column_name = 'id'
        `);
        console.log(`📋 Columna id: ${esquema[0]?.data_type} ${esquema[0]?.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);

        // Verificar triggers
        const triggers = await queryAsync(`
            SELECT trigger_name, event_manipulation
            FROM information_schema.triggers
            WHERE event_object_table = 'usuarios' AND event_manipulation = 'UPDATE'
        `);
        console.log(`🎯 Triggers UPDATE: ${triggers.length}`);

        // Ejecutar UPDATE
        console.log(`🔄 Ejecutando: UPDATE usuarios SET estado = '${estado}' WHERE id = ${id}`);
        const updateResult = await queryAsync(
            'UPDATE usuarios SET estado = $1 WHERE id = $2',
            [estado, id]
        );
        console.log(`✅ UPDATE result:`, updateResult);

        // Verificar estado DESPUÉS
        const despues = await queryAsync('SELECT estado FROM usuarios WHERE id = $1', [id]);
        console.log(`📊 Estado DESPUÉS: ${despues[0]?.estado}`);

        res.json({
            success: despues[0]?.estado === estado,
            antes: antes[0]?.estado,
            despues: despues[0]?.estado,
            esquema: esquema[0],
            triggers: triggers.length,
            updateResult: updateResult
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3002, () => {
    console.log('🔍 Servidor de diagnóstico corriendo en http://localhost:3002');
    console.log('📡 Endpoint: POST /test-update con body: { "id": 13, "estado": "activo" }');
});