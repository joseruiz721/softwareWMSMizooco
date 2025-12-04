const express = require('express');
const { queryAsync, tiposDispositivos } = require('../config/database');

const router = express.Router();

// ==============================================
// RUTAS GET
// ==============================================

// Obtener dispositivos por tipo
router.get("/:tipoDispositivo", async (req, res) => {
    const { tipoDispositivo } = req.params;
    
    console.log(`📱 Solicitando dispositivos de tipo: ${tipoDispositivo}`);
    
    if (!tiposDispositivos[tipoDispositivo]) {
        return res.status(400).json({ 
            success: false, 
            message: "Tipo de dispositivo no válido." 
        });
    }

    try {
        const tableConfig = tiposDispositivos[tipoDispositivo];
        const tableName = tableConfig.table;
        
        let orderField = 'fecha_ingreso';
        if (tipoDispositivo === 'mantenimientos') {
            orderField = 'fecha';
        }
        
        const sql = `SELECT * FROM ${tableName} ORDER BY ${orderField} DESC`;
        console.log(`🔍 Ejecutando consulta: ${sql}`);
        
        const dispositivos = await queryAsync(sql);
        
        console.log(`✅ Encontrados ${dispositivos.length} dispositivos de tipo ${tipoDispositivo}`);
        
        return res.json(dispositivos);
    } catch (error) {
        console.error(`❌ Error al obtener ${tipoDispositivo}:`, error.message);
        return res.json([]);
    }
});

// Obtener un dispositivo específico
router.get("/:tipo/:id", async (req, res) => {
    const { tipo, id } = req.params;
    
    console.log(`🔍 Solicitando dispositivo tipo: ${tipo}, ID: ${id}`);
    
    if (!tiposDispositivos[tipo]) {
        return res.status(400).json({
            success: false,
            message: "Tipo de dispositivo no válido."
        });
    }

    try {
        const tableName = tiposDispositivos[tipo].table;
        const rows = await queryAsync(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Dispositivo no encontrado."
            });
        }

        return res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error(`❌ Error al obtener ${tipo}:`, error);
        return res.status(500).json({
            success: false,
            message: `Error al obtener el ${tipo}.`,
            error: error.message
        });
    }
});

// ==============================================
// RUTAS POST - CREAR DISPOSITIVOS
// ==============================================

// Crear nuevo dispositivo
router.post("/:tipo", async (req, res) => {
    const { tipo } = req.params;
    
    console.log(`📝 Registrando dispositivo tipo: ${tipo}`, req.body);
    
    if (!tiposDispositivos[tipo]) {
        return res.status(400).json({
            success: false,
            message: "Tipo de dispositivo no válido."
        });
    }

    try {
        const tableName = tiposDispositivos[tipo].table;
        const campos = [];
        const valores = [];
        const placeholders = [];
        
        // Campos requeridos específicos (serial ya no es obligatorio)
        const camposRequeridos = {
            'ordenadores': ['ubicacion', 'fecha_ingreso'],
            'access_point': ['ubicacion', 'fecha_ingreso'],
            'readers': ['ubicacion', 'fecha_ingreso'],
            'etiquetadoras': ['ubicacion', 'fecha_ingreso'],
            'tablets': ['ubicacion', 'fecha_ingreso'],
            'lectores_qr': ['ubicacion', 'fecha_ingreso', 'modelo']
        }[tipo] || ['ubicacion', 'fecha_ingreso'];

        // Validar campos requeridos
        for (const campo of camposRequeridos) {
            if (!req.body[campo]) {
                return res.status(400).json({
                    success: false,
                    message: `El campo ${campo} es obligatorio para ${tiposDispositivos[tipo].name}.`
                });
            }
        }

        // Procesar campos específicos del tipo de dispositivo
        tiposDispositivos[tipo].campos.forEach((campo) => {
            if (req.body[campo] !== undefined && req.body[campo] !== null) {
                // Manejar campo serial especial
                if (campo === 'serial') {
                    const valorSerial = req.body[campo];
                    
                    // Si el serial está vacío o es nulo, no lo agregamos
                    if (valorSerial === '' || valorSerial === null) {
                        return;
                    }
                    
                    const serialNormalizado = valorSerial.toString().trim().toLowerCase();
                    
                    // Si el valor es "especial", convertirlo a NULL
                    if (serialNormalizado === 'ninguno' || serialNormalizado === 'no aplica' || 
                        serialNormalizado === 'n/a' || serialNormalizado === 'sin serial' || 
                        serialNormalizado === 'no tiene') {
                        // Para NULL, no agregamos el campo (la BD usará NULL por defecto)
                        return;
                    }
                    
                    campos.push(campo);
                    valores.push(req.body[campo]);
                } else if (campo === 'activo_fijo' && (req.body[campo] === '' || req.body[campo] === null)) {
                    // Para activo_fijo vacío, no lo agregamos
                    return;
                } else if (campo === 'activo') {
                    // Convertir valores booleanos
                    campos.push(campo);
                    valores.push(req.body[campo] === 'true' || req.body[campo] === true);
                } else {
                    campos.push(campo);
                    valores.push(req.body[campo]);
                }
            }
        });

        // Validar que tenemos campos para insertar
        if (campos.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No se proporcionaron datos válidos para registrar."
            });
        }

        // Validar duplicados solo si hay serial válido
        const hasSerial = req.body.serial && req.body.serial.trim() !== '';
        const serialValue = hasSerial ? req.body.serial.toString().trim().toLowerCase() : null;
        
        // Solo validar duplicados si hay un serial que no sea "especial"
        if (hasSerial && serialValue && 
            serialValue !== 'ninguno' && 
            serialValue !== 'no aplica' && 
            serialValue !== 'n/a' &&
            serialValue !== 'sin serial' &&
            serialValue !== 'no tiene') {
            
            const serialExistente = await queryAsync(
                `SELECT id FROM ${tableName} WHERE LOWER(TRIM(serial)) = $1`,
                [serialValue]
            );
            
            if (serialExistente.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Ya existe un dispositivo con este número de serie."
                });
            }
        }

        // Agregar campos comunes para dispositivos
        if (tipo !== 'mantenimientos' && tipo !== 'repuestos') {
            const idUsuarioField = tableName === 'access_point' || tableName === 'etiquetadoras' || tableName === 'lectores_qr' 
                ? 'id_usuarios_responsable' 
                : 'id_usuario_responsable';
            
            campos.push(idUsuarioField);
            valores.push(req.session.user.id);
        }

        // Crear placeholders después de tener todos los valores
        for (let i = 1; i <= valores.length; i++) {
            placeholders.push(`$${i}`);
        }

        const sql = `INSERT INTO ${tableName} (${campos.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`;
        console.log(`💾 Ejecutando SQL: ${sql}`, valores);
        
        const result = await queryAsync(sql, valores);

        console.log(`✅ ${tableName} registrado con éxito, ID: ${result[0].id}`);

        return res.json({ 
            success: true, 
            message: `${tiposDispositivos[tipo].name || tableName} registrado con éxito`,
            dispositivoId: result[0].id
        });

    } catch (error) {
        console.error(`❌ Error al registrar ${tipo}:`, error);
        
        // Manejar errores específicos de duplicados
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: "Ya existe un dispositivo con estos datos (serial o activo fijo duplicado)."
            });
        } else if (error.code === '23502') {
            return res.status(400).json({
                success: false,
                message: `Error: El campo '${error.column}' no puede ser nulo.`
            });
        }
        
        return res.status(500).json({
            success: false,
            message: `Error al registrar el ${tipo}.`,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==============================================
// RUTAS PUT - ACTUALIZAR DISPOSITIVOS
// ==============================================

// Actualizar dispositivo
router.put("/:tipo/:id", async (req, res) => {
    const { tipo, id } = req.params;
    
    console.log(`✏️ Actualizando dispositivo tipo: ${tipo}, ID: ${id}`, req.body);
    
    if (!tiposDispositivos[tipo]) {
        return res.status(400).json({
            success: false,
            message: "Tipo de dispositivo no válido."
        });
    }

    try {
        const tableName = tiposDispositivos[tipo].table;
        const rows = await queryAsync(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Dispositivo no encontrado."
            });
        }

        // Obtener datos actuales para validación
        const dispositivoActual = rows[0];
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        // Usar los campos definidos en tiposDispositivos
        tiposDispositivos[tipo].campos.forEach(campo => {
            if (req.body.hasOwnProperty(campo) && campo !== 'id') {
                // Manejar campo serial especial
                if (campo === 'serial') {
                    const valorSerial = req.body[campo];
                    
                    // Si el serial está vacío, nulo o es un valor especial
                    if (valorSerial === '' || valorSerial === null) {
                        updates.push(`${campo} = NULL`);
                        return;
                    }
                    
                    const serialNormalizado = valorSerial.toString().trim().toLowerCase();
                    
                    // Si el valor es "especial", establecer a NULL
                    if (serialNormalizado === 'ninguno' || serialNormalizado === 'no aplica' || 
                        serialNormalizado === 'n/a' || serialNormalizado === 'sin serial' || 
                        serialNormalizado === 'no tiene') {
                        updates.push(`${campo} = NULL`);
                        return;
                    }
                    
                    // Si tiene un valor válido
                    updates.push(`${campo} = $${paramCount}`);
                    values.push(valorSerial);
                    paramCount++;
                    return;
                }
                
                // Para otros campos
                updates.push(`${campo} = $${paramCount}`);
                
                // Manejar diferentes tipos de datos
                if (campo === 'activo') {
                    values.push(req.body[campo] === 'true' || req.body[campo] === true);
                } else if (campo === 'activo_fijo' && (req.body[campo] === '' || req.body[campo] === null)) {
                    values.push(null);
                } else {
                    values.push(req.body[campo] !== null ? req.body[campo] : null);
                }
                
                paramCount++;
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No se proporcionaron campos válidos para actualizar."
            });
        }

        // Validar duplicados de serial antes de actualizar
        if (req.body.serial && req.body.serial !== '' && req.body.serial !== null) {
            const serialNormalizado = req.body.serial.toString().trim().toLowerCase();
            
            // Solo validar si no es un valor "especial"
            if (serialNormalizado !== 'ninguno' && serialNormalizado !== 'no aplica' && 
                serialNormalizado !== 'n/a' && serialNormalizado !== 'sin serial' && 
                serialNormalizado !== 'no tiene') {
                
                // Verificar si hay otro dispositivo con el mismo serial
                const serialExistente = await queryAsync(
                    `SELECT id FROM ${tableName} WHERE LOWER(TRIM(serial)) = $1 AND id != $2`,
                    [serialNormalizado, id]
                );
                
                if (serialExistente.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Ya existe otro dispositivo con este número de serie."
                    });
                }
            }
        }

        // Agregar fecha de actualización si el campo existe
        if (tiposDispositivos[tipo].campos.includes('fecha_actualizacion')) {
            updates.push('fecha_actualizacion = CURRENT_TIMESTAMP');
        }
        
        values.push(id);
        
        const sql = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${paramCount}`;
        console.log(`💾 Ejecutando SQL: ${sql}`, values);
        
        await queryAsync(sql, values);

        // Obtener el dispositivo actualizado
        const updatedRows = await queryAsync(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        
        console.log(`✅ ${tableName} actualizado con éxito`);
        
        return res.json({ 
            success: true, 
            message: `${tiposDispositivos[tipo].name} actualizado con éxito`,
            data: updatedRows[0]
        });

    } catch (error) {
        console.error(`❌ Error al actualizar ${tipo}:`, error);
        
        // Manejar errores específicos
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: "Ya existe un dispositivo con estos datos (serial o activo fijo duplicado)."
            });
        } else if (error.code === '23502') {
            return res.status(400).json({
                success: false,
                message: `Error: El campo '${error.column}' no puede ser nulo.`
            });
        }
        
        return res.status(500).json({
            success: false,
            message: `Error al actualizar el ${tipo}.`,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==============================================
// RUTAS DELETE - ELIMINAR DISPOSITIVOS
// ==============================================

// Eliminar dispositivo
router.delete("/:tipo/:id", async (req, res) => {
    const { tipo, id } = req.params;
    
    console.log(`🗑️ Eliminando dispositivo tipo: ${tipo}, ID: ${id}`);
    
    if (!tiposDispositivos[tipo]) {
        return res.status(400).json({
            success: false,
            message: "Tipo de dispositivo no válido."
        });
    }

    try {
        const tableName = tiposDispositivos[tipo].table;
        
        // Verificar que el dispositivo existe
        const existingRecord = await queryAsync(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        if (existingRecord.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Registro no encontrado."
            });
        }

        const sql = `DELETE FROM ${tableName} WHERE id = $1`;
        await queryAsync(sql, [id]);
        
        return res.json({ 
            success: true, 
            message: `${tableName} eliminado con éxito`
        });

    } catch (error) {
        console.error(`❌ Error al eliminar ${tipo}:`, error);
        return res.status(500).json({
            success: false,
            message: `Error al eliminar el ${tipo}.`,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;