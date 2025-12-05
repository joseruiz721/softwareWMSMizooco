// scripts/run_schema.js
// Ejecuta schema.sql usando la configuración de `config/database.js`

const fs = require('fs');
const path = require('path');
const databaseConfig = require('../config/database');

async function run() {
    try {
        const filePath = path.join(__dirname, '..', 'schema.sql');
        if (!fs.existsSync(filePath)) {
            console.error('No se encontró schema.sql en la raíz del proyecto:', filePath);
            process.exit(1);
        }

        const sql = fs.readFileSync(filePath, 'utf8');
        // Separar por ";" que terminen declaraciones (simple, funciona para la mayoría de schemas)
        const statements = sql
            .split(/;\s*(?=\n|$)/g)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`Se encontraron ${statements.length} declaraciones SQL. Ejecutando...`);

        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            try {
                await databaseConfig.queryAsync(stmt);
                console.log(`✅ Ejecutada declaración ${i + 1}/${statements.length}`);
            } catch (err) {
                console.error(`❌ Error en declaración ${i + 1}:`, err.message || err);
                // Mostrar la declaración parcialmente para depuración
                console.error(stmt.substring(0, 500));
                process.exit(1);
            }
        }

        console.log('🎉 Schema aplicado correctamente.');
        process.exit(0);
    } catch (err) {
        console.error('Error al ejecutar el schema:', err.message || err);
        process.exit(1);
    }
}

run();
