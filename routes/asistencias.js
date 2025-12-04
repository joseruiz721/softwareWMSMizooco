const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const databaseConfig = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Asegurar carpeta de uploads para asistencias
const uploadsRoot = path.join(__dirname, '..', 'public', 'uploads');
const uploadDir = path.join(uploadsRoot, 'asistencias');

// Crear directorios si no existen
try {
    if (!fs.existsSync(uploadsRoot)) {
        fs.mkdirSync(uploadsRoot, { recursive: true });
    }
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (err) {
    console.error('❌ Error asegurando carpeta de uploads para asistencias:', err);
}

// Configurar multer para subida de fotos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const userId = req.body.usuario_id || req.session?.user?.id || req.session?.userId || req.user?.id || 'anon';
        const ts = Date.now();
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${userId}_${ts}_${file.fieldname}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB límite
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen'), false);
        }
    }
});

// Helper para obtener userId
function getUserIdFromReq(req) {
    return req.session?.user?.id || req.session?.userId || req.user?.id || null;
}

// Helper para obtener IP del cliente
function getClientIp(req) {
    return req.ip || 
           req.headers['x-forwarded-for'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           '127.0.0.1';
}

// Helper para ejecutar consultas
async function executeQuery(text, params) {
    try {
        const result = await databaseConfig.pool.query(text, params);
        return result.rows;
    } catch (error) {
        console.error('❌ Error en consulta SQL:', error.message);
        throw error;
    }
}

// Validar si el usuario ya tiene un registro del mismo tipo reciente
async function validarRegistroDuplicado(userId, tipo) {
    try {
        const query = `
            SELECT tipo, fecha 
            FROM asistencias 
            WHERE usuario_id = $1 
            ORDER BY fecha DESC 
            LIMIT 1
        `;
        
        const rows = await executeQuery(query, [userId]);
        
        if (rows.length === 0) {
            return null;
        }
        
        const ultimoRegistro = rows[0];
        const ahora = new Date();
        const fechaUltimoRegistro = new Date(ultimoRegistro.fecha);
        const diferenciaHoras = (ahora - fechaUltimoRegistro) / (1000 * 60 * 60);
        
        // Reducir a 30 minutos para mayor flexibilidad
        if (ultimoRegistro.tipo === tipo && diferenciaHoras < 0.5) {
            return {
                duplicado: true,
                mensaje: `Ya tienes un registro de ${tipo} registrado hace ${Math.round(diferenciaHoras * 60)} minutos.`,
                ultimoRegistro: ultimoRegistro
            };
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error validando registro duplicado:', error);
        return null;
    }
}

// 🔥 ENDPOINT ÚNICO PARA REGISTRO DE ASISTENCIA - TODOS LOS ROLES
router.post('/registrar', requireAuth, upload.single('foto'), async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const isAdmin = (req.session?.user?.role === 'admin') || (req.user?.role === 'admin');
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Usuario no autenticado' 
            });
        }

        const { tipo, usuario_id } = req.body;
        
        if (!tipo || (tipo !== 'entrada' && tipo !== 'salida')) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tipo de asistencia inválido. Use "entrada" o "salida"' 
            });
        }

        // DETERMINAR USUARIO DESTINO
        let usuarioDestino = userId;
        let esRegistroParaOtro = false;
        let nombreUsuarioDestino = req.session?.user?.nombre || 'Usuario';

        // 🔥 MODIFICACIÓN PRINCIPAL: Permitir a todos registrar para otros
        if (usuario_id && usuario_id != userId) {
            // Verificar que el usuario destino existe y está activo
            const usuarioCheck = await executeQuery(
                'SELECT id, nombre, role FROM usuarios WHERE id = $1',
                [usuario_id]
            );
            
            if (usuarioCheck.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuario destino no encontrado' 
                });
            }
            
            usuarioDestino = usuario_id;
            nombreUsuarioDestino = usuarioCheck[0].nombre;
            esRegistroParaOtro = true;
            
            console.log(`👤 Usuario ${req.session?.user?.nombre} (${req.session?.user?.role}) registrando asistencia para: ${nombreUsuarioDestino} (ID: ${usuario_id})`);
        } 
        // Registro normal para sí mismo
        else {
            console.log(`👤 Usuario ${req.session?.user?.nombre} registrando su propia asistencia`);
        }

        // VALIDAR REGISTRO DUPLICADO (solo para el usuario destino)
        const validacionDuplicado = await validarRegistroDuplicado(usuarioDestino, tipo);
        if (validacionDuplicado?.duplicado) {
            let mensajeError = validacionDuplicado.mensaje;
            
            // Personalizar mensaje si es para otro usuario
            if (esRegistroParaOtro) {
                mensajeError = `Usuario ${nombreUsuarioDestino}: ${validacionDuplicado.mensaje}`;
            }
            
            return res.status(400).json({
                success: false,
                message: mensajeError,
                esDuplicado: true,
                ultimoRegistro: validacionDuplicado.ultimoRegistro
            });
        }

        const fotoPath = req.file ? `/uploads/asistencias/${req.file.filename}` : null;
        const ip = getClientIp(req);
        const ua = req.headers['user-agent'] || '';

        // 🔥 INFORMACIÓN DEL REGISTRANTE
        const registranteId = userId;
        const registranteNombre = req.session?.user?.nombre || 'Anónimo';
        const registranteRole = req.session?.user?.role || 'user';

        // REGISTRAR EN BASE DE DATOS
        const query = `
            INSERT INTO asistencias (usuario_id, tipo, fecha, foto_path, ip_origen, user_agent, registrante_id, registrante_nombre, registrante_role)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8) 
            RETURNING *
        `;
        const params = [usuarioDestino, tipo, fotoPath, ip, ua, registranteId, registranteNombre, registranteRole];

        const rows = await executeQuery(query, params);

        // MENSAJE DE ÉXITO PERSONALIZADO
        let mensajeExito = `✅ Asistencia de ${tipo} registrada exitosamente`;
        if (esRegistroParaOtro) {
            mensajeExito = `✅ Asistencia de ${tipo} registrada para ${nombreUsuarioDestino} por ${registranteNombre}`;
        }

        console.log(`📸 ${mensajeExito}`);

        return res.json({ 
            success: true, 
            message: mensajeExito,
            data: rows[0] 
        });

    } catch (error) {
        console.error('❌ Error registrando asistencia:', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Error registrando asistencia: ' + error.message 
        });
    }
});

// 🔥 ENDPOINT REPORTE - MEJORADO
router.get('/reporte', requireAuth, async (req, res) => {
    try {
        const { start, end, usuario_id } = req.query;
        const userId = getUserIdFromReq(req);
        const isAdmin = (req.session?.user?.role === 'admin') || (req.user?.role === 'admin');

        // Validar fechas
        if (!start || !end) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren las fechas de inicio y fin'
            });
        }

        let whereClauses = [];
        let params = [];
        let paramCount = 1;

        // Agregar condiciones de fecha
        params.push(start);
        whereClauses.push(`DATE(a.fecha) >= $${paramCount++}`);
        
        params.push(end);
        whereClauses.push(`DATE(a.fecha) <= $${paramCount++}`);

        // 🔥 MEJORADO: Filtrado por permisos
        if (usuario_id && usuario_id.trim() !== '' && usuario_id !== 'todos') {
            params.push(usuario_id);
            whereClauses.push(`a.usuario_id = $${paramCount++}`);
        } else if (!isAdmin) {
            // Usuario normal solo ve sus propios registros
            params.push(userId);
            whereClauses.push(`a.usuario_id = $${paramCount++}`);
        }
        // Si es admin y no especifica usuario_id, ve todos

        const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        console.log(`📊 Generando reporte para ${isAdmin ? 'admin' : 'user'}: ${where}`, params);

        const query = `
            SELECT a.*, 
                   u.nombre, u.correo, u.cedula, u.role,
                   a.registrante_nombre, a.registrante_role
            FROM asistencias a 
            LEFT JOIN usuarios u ON a.usuario_id = u.id 
            ${where} 
            ORDER BY a.fecha DESC
            LIMIT 200
        `;

        const rows = await executeQuery(query, params);

        return res.json({ 
            success: true, 
            data: rows,
            isAdmin: isAdmin,
            total: rows.length
        });

    } catch (error) {
        console.error('❌ Error obteniendo reporte de asistencias:', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo reporte: ' + error.message 
        });
    }
});

// 🔥 NUEVO: Endpoint para que cualquier usuario vea sus registros
router.get('/mis-registros', requireAuth, async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const { start, end, limit = 50 } = req.query;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }
        
        let whereClauses = [`a.usuario_id = $1`];
        let params = [userId];
        let paramCount = 2;

        if (start) {
            params.push(start);
            whereClauses.push(`DATE(a.fecha) >= $${paramCount++}`);
        }
        if (end) {
            params.push(end);
            whereClauses.push(`DATE(a.fecha) <= $${paramCount++}`);
        }

        const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT a.*, u.nombre, u.correo, u.cedula, u.role
            FROM asistencias a 
            LEFT JOIN usuarios u ON a.usuario_id = u.id 
            ${where} 
            ORDER BY a.fecha DESC
            LIMIT $${paramCount}
        `;
        params.push(parseInt(limit));

        const rows = await executeQuery(query, params);

        return res.json({ 
            success: true, 
            data: rows,
            total: rows.length
        });

    } catch (error) {
        console.error('❌ Error obteniendo mis registros:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo registros: ' + error.message 
        });
    }
});

// 🔥 NUEVO: Estadísticas personales
router.get('/estadisticas-personales', requireAuth, async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const { mes, anio } = req.query;
        
        let whereClause = `WHERE a.usuario_id = $1`;
        let params = [userId];
        let paramCount = 2;
        
        if (mes && anio) {
            whereClause += ` AND EXTRACT(MONTH FROM a.fecha) = $${paramCount++} AND EXTRACT(YEAR FROM a.fecha) = $${paramCount++}`;
            params.push(parseInt(mes), parseInt(anio));
        }

        const query = `
            SELECT 
                DATE(a.fecha) as fecha,
                COUNT(CASE WHEN a.tipo = 'entrada' THEN 1 END) as entradas,
                COUNT(CASE WHEN a.tipo = 'salida' THEN 1 END) as salidas,
                COUNT(*) as total
            FROM asistencias a
            ${whereClause}
            GROUP BY DATE(a.fecha)
            ORDER BY fecha DESC
            LIMIT 30
        `;

        const rows = await executeQuery(query, params);

        return res.json({ 
            success: true, 
            data: rows 
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas personales:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo estadísticas' 
        });
    }
});

// Endpoint para obtener el último registro del usuario
router.get('/ultimo-registro', requireAuth, async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        
        const query = `
            SELECT tipo, fecha, foto_path
            FROM asistencias 
            WHERE usuario_id = $1 
            ORDER BY fecha DESC 
            LIMIT 1
        `;
        
        const rows = await executeQuery(query, [userId]);

        return res.json({ 
            success: true, 
            data: rows[0] || null 
        });

    } catch (error) {
        console.error('❌ Error obteniendo último registro:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo último registro' 
        });
    }
});

// Endpoint para estadísticas de asistencias (admin only)
router.get('/estadisticas', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { mes, anio } = req.query;
        
        let whereClause = '';
        let params = [];
        
        if (mes && anio) {
            whereClause = `WHERE EXTRACT(MONTH FROM a.fecha) = $1 AND EXTRACT(YEAR FROM a.fecha) = $2`;
            params = [parseInt(mes), parseInt(anio)];
        }

        const query = `
            SELECT 
                u.nombre,
                u.role,
                COUNT(CASE WHEN a.tipo = 'entrada' THEN 1 END) as entradas,
                COUNT(CASE WHEN a.tipo = 'salida' THEN 1 END) as salidas,
                COUNT(*) as total
            FROM asistencias a
            JOIN usuarios u ON a.usuario_id = u.id
            ${whereClause}
            GROUP BY u.id, u.nombre, u.role
            ORDER BY total DESC
        `;

        const rows = await executeQuery(query, params);

        return res.json({ 
            success: true, 
            data: rows 
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo estadísticas' 
        });
    }
});

// Endpoint para exportar reporte a CSV (admin only)
router.get('/exportar-csv', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { start, end, usuario_id } = req.query;
        
        if (!start || !end) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren las fechas de inicio y fin'
            });
        }
        
        let whereClauses = [];
        let params = [];
        let paramCount = 1;

        params.push(start);
        whereClauses.push(`DATE(a.fecha) >= $${paramCount++}`);
        
        params.push(end);
        whereClauses.push(`DATE(a.fecha) <= $${paramCount++}`);
        
        if (usuario_id && usuario_id.trim() !== '' && usuario_id !== 'todos') {
            params.push(usuario_id);
            whereClauses.push(`a.usuario_id = $${paramCount++}`);
        }

        const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT 
                a.id,
                u.nombre as usuario,
                u.cedula,
                u.correo,
                u.role,
                a.tipo,
                TO_CHAR(a.fecha, 'YYYY-MM-DD HH24:MI:SS') as fecha,
                a.foto_path,
                a.ip_origen,
                a.user_agent,
                a.registrante_nombre,
                a.registrante_role
            FROM asistencias a 
            LEFT JOIN usuarios u ON a.usuario_id = u.id 
            ${where} 
            ORDER BY a.fecha DESC
        `;

        const rows = await executeQuery(query, params);

        // Convertir a CSV
        const csvHeader = 'ID,Usuario,Cédula,Correo,Rol,Tipo,Fecha,Foto,IP,User-Agent,Registrado Por,Rol Registrante\n';
        const csvRows = rows.map(row => 
            `"${row.id}","${row.usuario || ''}","${row.cedula || ''}","${row.correo || ''}","${row.role || ''}","${row.tipo}","${row.fecha}","${row.foto_path || ''}","${row.ip_origen || ''}","${row.user_agent || ''}","${row.registrante_nombre || ''}","${row.registrante_role || ''}"`
        ).join('\n');

        const csvContent = csvHeader + csvRows;
        
        const filename = `reporte_asistencias_${new Date().toISOString().split('T')[0]}.csv`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csvContent);

    } catch (error) {
        console.error('❌ Error exportando reporte CSV:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error exportando reporte: ' + error.message 
        });
    }
});

// Manejo de errores de multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'El archivo es demasiado grande. Máximo 5MB permitido.'
            });
        }
    }
    
    if (error.message.includes('Solo se permiten archivos de imagen')) {
        return res.status(400).json({
            success: false,
            message: 'Solo se permiten archivos de imagen (JPG, PNG, etc.)'
        });
    }
    
    next(error);
});

module.exports = router;