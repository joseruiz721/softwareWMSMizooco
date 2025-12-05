// server.js - VERSIÓN CORREGIDA PARA ASISTENCIAS CON FOTOS Y MULTI-USUARIO
require('dotenv').config(); 

const express = require("express");
const path = require("path");
const session = require("express-session");
const cors = require("cors");

// Importar configuraciones y rutas
const databaseConfig = require('./config/database');
const { 
    requireAuth, 
    authenticateToken, 
    requireAdmin, 
    enrichSessionWithUserData,
    optionalToken,
    checkAuthStatus 
} = require('./middleware/auth');
const Logger = require('./config/logger');

// Importar rutas
const authRoutes = require('./routes/auth');
const usuarioRoutes = require('./routes/usuarios');
const dispositivoRoutes = require('./routes/dispositivos');
const repuestoRoutes = require('./routes/repuestos');
const mantenimientoRoutes = require('./routes/mantenimientos');
const dashboardRoutes = require('./routes/dashboard');

// Importar rutas de horarios calendario y asistencias
const horariosCalendarioRoutes = require('./routes/horariosCalendario');
const asistenciasRoutes = require('./routes/asistencias');

const app = express();

// ==============================================
// CONFIGURACIÓN INICIAL - CRÍTICAMENTE CORREGIDA
// ==============================================

// Configurar CORS primero
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Configurar sesión antes de los parsers
app.set('trust proxy', 1); 
app.use(session({
    store: databaseConfig.sessionStore,
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-2024-wms-mizooco',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Middleware para archivos estáticos PRIMERO
app.use(express.static(path.join(__dirname, "public")));

// Servir archivos subidos (uploads) desde public/uploads
app.use('/uploads', express.static(path.join(__dirname, "public", "uploads")));

// Middleware para JSON y URL encoded para el resto de rutas
// Excluimos las rutas que manejan multipart
app.use((req, res, next) => {
    const url = req.url;
    
    // Si es una ruta que maneja FormData (asistencias), saltar los parsers de JSON
    if (url.includes('/api/asistencias/registrar') || 
        url.includes('/api/asistencias/checkin') || 
        url.includes('/api/asistencias/checkout') ||
        url.includes('/api/asistencias/registrar-multi')) {
        
        // Para estas rutas, no usar body-parser JSON
        // multer se encargará de parsear el multipart
        req._body = true;
        req.body = {};
        return next();
    }
    
    // Para otras rutas, usar body-parser normal
    express.json({ limit: '10mb' })(req, res, (err) => {
        if (err && err.type === 'entity.parse.failed') {
            if (!req.headers['content-type']?.includes('application/json')) {
                req._body = true;
                req.body = {};
                return next();
            }
            return res.status(400).json({
                success: false,
                message: 'JSON inválido'
            });
        }
        next(err);
    });
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de enriquecimiento de sesión OPTIMIZADO
app.use((req, res, next) => {
    // Excluir archivos estáticos y rutas que no necesitan enriquecimiento
    if (req.path.startsWith('/css/') || 
        req.path.startsWith('/js/') || 
        req.path.startsWith('/img/') ||
        req.path === '/favicon.ico' ||
        req.path === '/api/health' ||
        req.path === '/manifest.json') {
        return next();
    }
    
    // Solo enriquecer sesión si hay usuario autenticado y no está ya enriquecida
    if (req.session.userId && !req.session.enriched) {
        enrichSessionWithUserData(req, res, next);
    } else {
        next();
    }
});

// Middleware de logging OPTIMIZADO
app.use((req, res, next) => {
    // Excluir archivos estáticos del logging detallado
    if (req.path.startsWith('/css/') || 
        req.path.startsWith('/js/') || 
        req.path.startsWith('/img/') ||
        req.path === '/favicon.ico') {
        return next();
    }
    
    const userInfo = req.session?.user ? `${req.session.user.nombre} (${req.session.user.role})` : 'No autenticado';
    Logger.http(req.method, req.path, req.sessionID, userInfo);
    next();
});

// ==============================================
// RUTAS PRINCIPALES - PERMISOS ACTUALIZADOS
// ==============================================

// Rutas de autenticación (públicas)
app.use('/auth', authRoutes);

// Rutas de API - TODOS LOS USUARIOS AUTENTICADOS PUEDEN ACCEDER
app.use('/api/usuarios', optionalToken, usuarioRoutes);
app.use('/api/dispositivos', optionalToken, dispositivoRoutes);
app.use('/api/repuestos', optionalToken, repuestoRoutes);
app.use('/api/mantenimientos', optionalToken, mantenimientoRoutes);
app.use('/api/dashboard', optionalToken, dashboardRoutes);

// Rutas de horarios calendario
app.use('/api/horarios-calendario', requireAuth, horariosCalendarioRoutes);

// 🔥 NUEVO: Rutas para gestión de asistencias - CON SISTEMA MULTI-USUARIO
app.use('/api/asistencias', requireAuth, asistenciasRoutes);

// RUTAS DE ADMINISTRACIÓN (SOLO PARA ADMINS)
app.use('/api/admin/usuarios', authenticateToken, requireAdmin, usuarioRoutes);

// ==============================================
// 🔥 NUEVAS RUTAS PARA SISTEMA MULTI-USUARIO DE ASISTENCIAS
// ==============================================

// 🔥 Ruta para obtener usuarios activos - MODIFICADA
app.get('/api/usuarios/activos', requireAuth, async (req, res) => {
    try {
        console.log('📋 Solicitando lista de usuarios activos...');
        
        // Query para obtener todos los usuarios activos
        const rows = await databaseConfig.queryAsync(
            `SELECT id, cedula, nombre, correo, role, fecha_registro 
             FROM usuarios 
             WHERE role IN ('admin', 'user', 'tecnico')
             ORDER BY nombre ASC`
        );
        
        console.log(`✅ ${rows.length} usuarios cargados para selector`);
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('❌ Error obteniendo usuarios activos:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la lista de usuarios'
        });
    }
});

// 🔥 NUEVO: Ruta para que usuarios normales vean registros recientes
app.get('/api/asistencias/registros-recientes', requireAuth, async (req, res) => {
    try {
        const userId = req.session?.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }
        
        const hoy = new Date().toISOString().split('T')[0];
        const rows = await databaseConfig.queryAsync(
            `SELECT a.tipo, a.fecha, a.foto_path, 
                    u.nombre as usuario_nombre,
                    a.registrante_nombre
             FROM asistencias a
             LEFT JOIN usuarios u ON a.usuario_id = u.id
             WHERE (a.usuario_id = $1 OR a.registrante_id = $1)
             AND DATE(a.fecha) = $2
             ORDER BY a.fecha DESC
             LIMIT 10`,
            [userId, hoy]
        );
        
        return res.json({
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo registros recientes:', error);
        return res.status(500).json({
            success: false,
            message: 'Error obteniendo registros recientes'
        });
    }
});

// 🔥 NUEVO: Endpoint para dashboard - obtener estadísticas rápidas diferenciadas por rol
app.get('/api/asistencias/dashboard-estadisticas', requireAuth, async (req, res) => {
    try {
        const userId = req.session?.user?.id;
        const isAdmin = req.session?.user?.role === 'admin';
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }
        
        let estadisticas = {};
        
        if (isAdmin) {
            // Para admin: total de registros hoy
            const hoy = new Date().toISOString().split('T')[0];
            const totalHoy = await databaseConfig.queryAsync(
                `SELECT COUNT(*) as total FROM asistencias WHERE DATE(fecha) = $1`,
                [hoy]
            );
            
            // Últimos 5 registros de todos los usuarios
            const ultimosRegistros = await databaseConfig.queryAsync(
                `SELECT a.*, u.nombre, u.cedula
                 FROM asistencias a 
                 JOIN usuarios u ON a.usuario_id = u.id 
                 ORDER BY a.fecha DESC 
                 LIMIT 5`
            );
            
            // Usuarios que registraron hoy
            const usuariosHoy = await databaseConfig.queryAsync(
                `SELECT DISTINCT u.nombre, COUNT(a.id) as registros
                 FROM asistencias a
                 JOIN usuarios u ON a.usuario_id = u.id
                 WHERE DATE(a.fecha) = $1
                 GROUP BY u.id, u.nombre
                 ORDER BY registros DESC`,
                [hoy]
            );
            
            estadisticas = {
                totalHoy: parseInt(totalHoy[0]?.total || 0),
                ultimosRegistros: ultimosRegistros,
                usuariosHoy: usuariosHoy,
                isAdmin: true
            };
        } else {
            // Para usuario normal: su último registro y estadísticas personales
            const ultimoRegistro = await databaseConfig.queryAsync(
                `SELECT tipo, fecha FROM asistencias 
                 WHERE usuario_id = $1 
                 ORDER BY fecha DESC 
                 LIMIT 1`,
                [userId]
            );
            
            // Registros de hoy del usuario
            const hoy = new Date().toISOString().split('T')[0];
            const registrosHoy = await databaseConfig.queryAsync(
                `SELECT tipo, fecha FROM asistencias 
                 WHERE usuario_id = $1 AND DATE(fecha) = $2
                 ORDER BY fecha DESC`,
                [userId, hoy]
            );
            
            estadisticas = {
                ultimoRegistro: ultimoRegistro[0] || null,
                registrosHoy: registrosHoy,
                totalHoy: registrosHoy.length,
                isAdmin: false
            };
        }
        
        return res.json({
            success: true,
            data: estadisticas
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de dashboard:', error);
        return res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas'
        });
    }
});

// ==============================================
// RUTA ESPECIAL PARA VERIFICACIÓN DE ROLES - CORREGIDA
// ==============================================

app.get('/api/check-admin', requireAuth, (req, res) => {
    const isAuthenticated = !!req.session.user;
    const isAdmin = req.session.user?.role === 'admin';
    
    console.log('🔐 Verificación de rol administrador:', {
        usuario: req.session.user?.nombre || 'No autenticado',
        esAdmin: isAdmin
    });
    
    res.json({
        success: true,
        authenticated: isAuthenticated,
        isAdmin: isAdmin,
        user: req.session.user ? {
            id: req.session.user.id,
            nombre: req.session.user.nombre,
            correo: req.session.user.correo,
            role: req.session.user.role
        } : null
    });
});

app.get('/api/auth-status', checkAuthStatus, (req, res) => {
    res.json({
        success: true,
        authenticated: req.authStatus.authenticated,
        user: req.authStatus.user,
        method: req.authStatus.method,
        isAdmin: req.authStatus.user?.role === 'admin'
    });
});

// Ruta para obtener información del usuario actual
app.get('/api/usuarios/perfil', authenticateToken, async (req, res) => {
    try {
        const userData = await databaseConfig.queryAsync(
            `SELECT id, cedula, nombre, correo, role, fecha_registro 
             FROM usuarios WHERE id = $1`,
            [req.user.id]
        );
        
        if (userData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }
        
        res.json({
            success: true,
            user: userData[0]
        });
    } catch (error) {
        Logger.error('Error obteniendo perfil de usuario', {
            error: error.message,
            usuario: req.user.nombre
        });
        res.status(500).json({
            success: false,
            message: 'Error al obtener perfil'
        });
    }
});

// ==============================================
// NUEVAS RUTAS PARA GESTIÓN DE USUARIOS EN PÁGINA PRINCIPAL
// ==============================================

// 🔐 Obtener lista completa de usuarios (solo para admins)
app.get('/api/admin/usuarios/lista', authenticateToken, requireAdmin, async (req, res) => {
    try {
        Logger.info('Solicitando lista completa de usuarios', {
            usuario: req.user.nombre
        });

        const users = await databaseConfig.queryAsync(
            `SELECT id, cedula, nombre, correo, role, fecha_registro
             FROM usuarios 
             ORDER BY nombre ASC`
        );

        Logger.info(`Lista de usuarios enviada: ${users.length} usuarios`, {
            usuario: req.user.nombre
        });

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        Logger.error('Error obteniendo lista de usuarios', {
            error: error.message,
            usuario: req.user.nombre
        });
        res.status(500).json({
            success: false,
            message: 'Error al obtener la lista de usuarios'
        });
    }
});

// 🔐 Cambiar rol de usuario (solo para admins)
app.put('/api/admin/usuarios/:id/rol', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Rol inválido. Debe ser "admin" o "user"'
            });
        }

        // Verificar que no sea el propio usuario
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'No puedes cambiar tu propio rol'
            });
        }

        // Verificar que no sea el último administrador
        if (role === 'user') {
            const adminCount = await databaseConfig.queryAsync(
                'SELECT COUNT(*) as count FROM usuarios WHERE role = $1 AND id != $2',
                ['admin', userId]
            );

            if (parseInt(adminCount[0].count) === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes quitar el rol de administrador al último admin del sistema'
                });
            }
        }

        const result = await databaseConfig.queryAsync(
            'UPDATE usuarios SET role = $1 WHERE id = $2 RETURNING id, nombre, correo, role',
            [role, userId]
        );

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        Logger.info('Rol de usuario actualizado', {
            administrador: req.user.nombre,
            usuario: result[0].nombre,
            nuevoRol: role
        });

        res.json({
            success: true,
            message: `Rol de ${result[0].nombre} actualizado a ${role}`,
            user: result[0]
        });

    } catch (error) {
        Logger.error('Error actualizando rol de usuario', {
            error: error.message,
            administrador: req.user.nombre,
            usuarioId: req.params.id
        });
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el rol del usuario'
        });
    }
});

// 🔐 Eliminar usuario (solo para admins)
app.delete('/api/admin/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // Verificar que no sea el propio usuario
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'No puedes eliminarte a ti mismo'
            });
        }

        // Verificar que el usuario existe
        const user = await databaseConfig.queryAsync(
            'SELECT id, nombre, role FROM usuarios WHERE id = $1',
            [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Verificar que no sea el último administrador
        if (user[0].role === 'admin') {
            const adminCount = await databaseConfig.queryAsync(
                'SELECT COUNT(*) as count FROM usuarios WHERE role = $1 AND id != $2',
                ['admin', userId]
            );

            if (parseInt(adminCount[0].count) === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes eliminar al último administrador del sistema'
                });
            }
        }

        // Eliminar el usuario
        await databaseConfig.queryAsync(
            'DELETE FROM usuarios WHERE id = $1',
            [userId]
        );

        Logger.info('Usuario eliminado del sistema', {
            administrador: req.user.nombre,
            usuarioEliminado: user[0].nombre
        });

        res.json({
            success: true,
            message: `Usuario ${user[0].nombre} eliminado correctamente`
        });

    } catch (error) {
        Logger.error('Error eliminando usuario', {
            error: error.message,
            administrador: req.user.nombre,
            usuarioId: req.params.id
        });
        res.status(500).json({
            success: false,
            message: 'Error al eliminar el usuario'
        });
    }
});

// Ruta para eliminar cuenta propia (solo para administradores)
app.delete('/api/usuarios/perfil', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Verificar si el usuario es administrador
        const userData = await databaseConfig.queryAsync(
            'SELECT role FROM usuarios WHERE id = $1',
            [userId]
        );
        
        if (userData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }
        
        if (userData[0].role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Solo los administradores pueden eliminar cuentas'
            });
        }
        
        // Verificar que no sea el último administrador
        const adminCount = await databaseConfig.queryAsync(
            'SELECT COUNT(*) as count FROM usuarios WHERE role = $1 AND id != $2',
            ['admin', userId]
        );

        if (parseInt(adminCount[0].count) === 0) {
            return res.status(400).json({
                success: false,
                message: 'No puedes eliminar la cuenta del último administrador del sistema'
            });
        }
        
        // Eliminar el usuario
        await databaseConfig.queryAsync(
            'DELETE FROM usuarios WHERE id = $1',
            [userId]
        );
        
        Logger.info('Cuenta eliminada por administrador', {
            usuario: req.user.nombre,
            id: userId
        });
        
        res.json({
            success: true,
            message: 'Cuenta eliminada correctamente'
        });
        
    } catch (error) {
        Logger.error('Error eliminando cuenta', {
            error: error.message,
            usuario: req.user.nombre
        });
        res.status(500).json({
            success: false,
            message: 'Error al eliminar cuenta'
        });
    }
});

// ==============================================
// RUTA DE BÚSQUEDA AVANZADA - CORREGIDA
// ==============================================

app.get('/api/buscar-avanzado', authenticateToken, async (req, res) => {
    try {
        const { q: query } = req.query;
        
        Logger.info('Búsqueda avanzada solicitada', { 
            usuario: req.user.nombre,
            termino: query 
        });
        
        if (!query || query.trim().length < 2) {
            return res.json([]);
        }

        const searchTerm = `%${query.trim()}%`;
        
        // Búsqueda en dispositivos (todas las tablas) - CORREGIDAS
        const deviceQueries = [
            // Ordenadores
            {
                sql: `SELECT id, serial as nombre, ip, ubicacion, estado, 'ordenadores' as tipo, 'Ordenador' as tipo_detalle, activo_fijo 
                     FROM ordenadores 
                     WHERE serial ILIKE $1 OR ip ILIKE $1 OR ubicacion ILIKE $1 OR activo_fijo ILIKE $1 OR estado ILIKE $1`,
                params: [searchTerm]
            },
            
            // Access Point
            {
                sql: `SELECT id, serial as nombre, ip, ubicacion, estado, 'access_point' as tipo, 'Access Point' as tipo_detalle, activo_fijo 
                     FROM access_point 
                     WHERE serial ILIKE $1 OR ip ILIKE $1 OR ubicacion ILIKE $1 OR activo_fijo ILIKE $1 OR estado ILIKE $1`,
                params: [searchTerm]
            },
            
            // Readers
            {
                sql: `SELECT id, serial as nombre, ip, ubicacion, estado, 'readers' as tipo, 'Reader' as tipo_detalle, activo_fijo 
                     FROM readers 
                     WHERE serial ILIKE $1 OR ip ILIKE $1 OR ubicacion ILIKE $1 OR activo_fijo ILIKE $1 OR estado ILIKE $1`,
                params: [searchTerm]
            },
            
            // Etiquetadoras
            {
                sql: `SELECT id, serial as nombre, ip, ubicacion, estado, 'etiquetadoras' as tipo, 'Etiquetadora' as tipo_detalle, activo_fijo 
                     FROM etiquetadoras 
                     WHERE serial ILIKE $1 OR ip ILIKE $1 OR ubicacion ILIKE $1 OR activo_fijo ILIKE $1 OR estado ILIKE $1`,
                params: [searchTerm]
            },
            
            // Tablets
            {
                sql: `SELECT id, serial as nombre, ip, ubicacion, estado, 'tablets' as tipo, 'Tablet' as tipo_detalle, activo_fijo 
                     FROM tablets 
                     WHERE serial ILIKE $1 OR ip ILIKE $1 OR ubicacion ILIKE $1 OR activo_fijo ILIKE $1 OR estado ILIKE $1`,
                params: [searchTerm]
            },
            
            // Lectores QR - CORREGIDA (sin columna serial)
            {
                sql: `SELECT id, modelo as nombre, ubicacion, estado, 'lectores_qr' as tipo, 'Lector QR' as tipo_detalle, activo_fijo 
                     FROM lectores_qr 
                     WHERE modelo ILIKE $1 OR ubicacion ILIKE $1 OR activo_fijo ILIKE $1 OR estado ILIKE $1`,
                params: [searchTerm]
            }
        ];

        // Búsqueda en repuestos
        const supplyQuery = {
            sql: `SELECT id, nombre, codigo, cantidad, stock_minimo, ubicacion, 'repuestos' as tipo, 'Repuesto' as tipo_detalle 
                 FROM repuestos 
                 WHERE nombre ILIKE $1 OR codigo ILIKE $1 OR ubicacion ILIKE $1`,
            params: [searchTerm]
        };

        // Búsqueda en mantenimientos - SIMPLIFICADA
        const maintenanceQuery = {
            sql: `SELECT m.id, m.descripcion as nombre, m.tipo, m.estado, m.fecha,
                         'mantenimientos' as tipo, 'Mantenimiento' as tipo_detalle,
                         u.nombre as tecnico_nombre
                 FROM mantenimientos m
                 LEFT JOIN usuarios u ON m.id_usuarios = u.id
                 WHERE m.descripcion ILIKE $1 OR m.tipo ILIKE $1 OR m.estado ILIKE $1 OR u.nombre ILIKE $1`,
            params: [searchTerm]
        };

        // Ejecutar todas las consultas en paralelo
        const allQueries = [
            ...deviceQueries.map(q => databaseConfig.queryAsync(q.sql, q.params)),
            databaseConfig.queryAsync(supplyQuery.sql, supplyQuery.params),
            databaseConfig.queryAsync(maintenanceQuery.sql, maintenanceQuery.params)
        ];

        const results = await Promise.allSettled(allQueries);
        
        // Procesar resultados
        const searchResults = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                const rows = result.value;
                
                if (rows.length > 0) {
                    Logger.debug(`Resultados encontrados en consulta ${index + 1}`, { 
                        cantidad: rows.length 
                    });
                    
                    // Agregar resultados al array principal
                    searchResults.push(...rows.map(row => ({
                        id: row.id,
                        nombre: row.nombre,
                        tipo: row.tipo,
                        tipo_detalle: row.tipo_detalle,
                        // Campos específicos por tipo
                        ...(row.tipo === 'repuestos' && {
                            codigo: row.codigo,
                            cantidad: row.cantidad,
                            stock_minimo: row.stock_minimo,
                            ubicacion: row.ubicacion
                        }),
                        ...(row.tipo !== 'repuestos' && row.tipo !== 'mantenimientos' && {
                            ip: row.ip,
                            ubicacion: row.ubicacion,
                            estado: row.estado,
                            activo_fijo: row.activo_fijo
                        }),
                        ...(row.tipo === 'mantenimientos' && {
                            tipo: row.tipo,
                            estado: row.estado,
                            fecha: row.fecha,
                            tecnico_nombre: row.tecnico_nombre
                        })
                    })));
                }
            } else if (result.status === 'rejected') {
                Logger.warn(`Error en consulta de búsqueda ${index + 1}`, { 
                    error: result.reason.message 
                });
            }
        });

        Logger.info('Búsqueda completada', { 
            totalResultados: searchResults.length,
            usuario: req.user.nombre
        });
        
        // Limitar resultados para mejor performance
        const limitedResults = searchResults.slice(0, 50);
        
        res.json(limitedResults);
        
    } catch (error) {
        Logger.error('Error en búsqueda avanzada', {
            error: error.message,
            usuario: req.user.nombre
        });
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor en la búsqueda'
        });
    }
});

// ==============================================
// RUTAS DE PÁGINAS HTML - PERMISOS ACTUALIZADOS
// ==============================================

// Rutas públicas
app.get("/", (req, res) => {
    Logger.info('Sirviendo página de login');
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/registro", (req, res) => {
    Logger.info('Sirviendo página de REGISTRO PÚBLICO');
    res.sendFile(path.join(__dirname, "public", "registro.html"));
});

app.get('/solicitar-reset', (req, res) => {
    Logger.info('Sirviendo página de recuperación de contraseña');
    res.sendFile(path.join(__dirname, 'public', 'solicitar_reset.html'));
});

// 👑 Ruta de administradores (solo para admins) - CORREGIDA
app.get("/admin-register", requireAuth, requireAdmin, (req, res) => {
    Logger.info('Sirviendo página de registro de administradores', { 
        usuario: req.session.user.nombre,
        rol: req.session.user.role
    });
    
    // Verificar si ya está en dashboard para evitar sesiones duplicadas
    if (req.headers.referer && req.headers.referer.includes('/dashboard')) {
        console.log('📋 Acceso a admin-register desde dashboard - sesión única');
    } else {
        console.log('⚠️ Acceso directo a admin-register - redirigiendo al dashboard');
        return res.redirect('/dashboard');
    }
    
    // Verificar si existe el archivo, sino redirigir al registro normal
    const adminRegisterPath = path.join(__dirname, "public", "admin-register.html");
    const fs = require('fs');
    
    if (fs.existsSync(adminRegisterPath)) {
        res.sendFile(adminRegisterPath);
    } else {
        // Redirigir al registro normal si no existe la página de admin
        res.redirect('/registro');
    }
});

// Rutas protegidas - TODOS LOS USUARIOS AUTENTICADOS PUEDEN ACCEDER
app.get("/dashboard", requireAuth, (req, res) => {
    Logger.auth('Acceso al dashboard', req.session.user.nombre, true);
    res.sendFile(path.join(__dirname, "public", "paginaPrincipal.html"));
});

app.get("/dispositivos", requireAuth, (req, res) => {
    Logger.info('Sirviendo página de dispositivos', { 
        usuario: req.session.user.nombre,
        rol: req.session.user.role
    });
    res.sendFile(path.join(__dirname, "public", "registroDispositivos.html"));
});

app.get("/repuestos", requireAuth, (req, res) => {
    Logger.info('Sirviendo página de repuestos', { 
        usuario: req.session.user.nombre,
        rol: req.session.user.role
    });
    res.sendFile(path.join(__dirname, "public", "registroRepuestos.html"));
});

app.get("/mantenimientos", requireAuth, (req, res) => {
    Logger.info('Sirviendo página de mantenimientos', { 
        usuario: req.session.user.nombre,
        rol: req.session.user.role
    });
    res.sendFile(path.join(__dirname, "public", "registroMantenimientos.html"));
});

// 🔐 Ruta de usuarios (solo para admins)
app.get("/usuarios", requireAuth, requireAdmin, (req, res) => {
    Logger.info('Sirviendo página de usuarios', { 
        usuario: req.session.user.nombre,
        rol: req.session.user.role
    });
    
    res.sendFile(path.join(__dirname, "public", "registroUsuarios.html"));
});

// ==============================================
// RUTAS DE RECUPERACIÓN DE CONTRASEÑA - CORREGIDAS
// ==============================================

// Función auxiliar para servir la página de restablecimiento
async function serveResetPasswordPage(req, res) {
    const { token } = req.params;
    
    Logger.info('Verificando token de recuperación', { token });
    
    try {
        const rows = await databaseConfig.queryAsync(
            "SELECT id, nombre, correo FROM usuarios WHERE reset_token = $1 AND reset_token_expires > NOW()",
            [token]
        );

        if (rows.length === 0) {
            Logger.warn('Token de recuperación inválido o expirado', { token });
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Enlace Inválido - Gestion WMS</title>
                    <style>
                        body { 
                            font-family: 'Poppins', Arial, sans-serif; 
                            text-align: center; 
                            padding: 50px; 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                        }
                        .container {
                            background: rgba(255,255,255,0.1);
                            backdrop-filter: blur(10px);
                            padding: 40px;
                            border-radius: 15px;
                            max-width: 500px;
                            margin: 0 auto;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                        }
                        h2 { 
                            color: #ff6b6b; 
                            margin-bottom: 20px;
                        }
                        a { 
                            color: #4fc3f7; 
                            text-decoration: none;
                            font-weight: 500;
                            padding: 10px 20px;
                            border: 2px solid #4fc3f7;
                            border-radius: 5px;
                            transition: all 0.3s ease;
                        }
                        a:hover {
                            background: #4fc3f7;
                            color: white;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>❌ Enlace Inválido o Expirado</h2>
                        <p>El enlace de restablecimiento es inválido o ha expirado.</p>
                        <p>Solicita un nuevo enlace desde la página de recuperación.</p>
                        <br>
                        <a href="/solicitar-reset">Solicitar Nuevo Enlace</a>
                    </div>
                </body>
                </html>
            `);
        }
        
        Logger.info('Token válido, sirviendo página de restablecimiento', { 
            usuario: rows[0].nombre 
        });
        res.sendFile(path.join(__dirname, 'public', 'reestablecer-contraseña.html'));
    } catch (error) {
        Logger.error("Error verificando token de recuperación", {
            error: error.message,
            token: token
        });
        return res.status(500).send(`
            <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: #e74c3c;">Error del Servidor</h2>
                <p>Ha ocurrido un error interno. Por favor, intenta más tarde.</p>
                <a href="/solicitar-reset">Volver a recuperación</a>
            </body>
            </html>
        `);
    }
}

// Ruta principal para restablecimiento con token (MANEJA AMBAS CODIFICACIONES)
app.get('/auth/reestablecer-contraseña/:token', async (req, res) => {
    await serveResetPasswordPage(req, res);
});

// Ruta alternativa para manejar la codificación URL
app.get('/auth/reestablecer-contrase%C3%B1a/:token', async (req, res) => {
    await serveResetPasswordPage(req, res);
});

// Ruta legacy para compatibilidad
app.get('/reestablecer-pass/:token', async (req, res) => {
    await serveResetPasswordPage(req, res);
});

// ==============================================
// RUTAS DE SALUD Y ESTADO - CORREGIDAS
// ==============================================

// Ruta de salud que no requiere autenticación
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        session: req.sessionID ? 'Activa' : 'No activa',
        user: req.session?.user ? 'Autenticado' : 'No autenticado'
    });
});

// ==============================================
// RUTA DE PRUEBA PARA VERIFICAR SESIONES Y ROLES
// ==============================================

app.get("/debug-session", (req, res) => {
    Logger.debug('Solicitando información de sesión para debug');
    res.json({
        sessionID: req.sessionID,
        session: req.session,
        user: req.session.user,
        cookies: req.headers.cookie
    });
});

// ==============================================
// RUTAS ADICIONALES PARA ARCHIVOS ESTÁTICOS - CORREGIDAS
// ==============================================

app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Ruta para CSS de registro
app.get('/css/registro.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'css', 'styles.css'));
});

// Ruta para CSS de admin-users
app.get('/css/admin-users.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'css', 'admin-users.css'));
});

// Ruta para CSS de login
app.get('/css/login.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'css', 'login.css'));
});

// Ruta para admin-users.js
app.get('/js/admin-users.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'js', 'admin-users.js'));
});

// ==============================================
// MANEJO DE ERRORES - MEJORADO
// ==============================================

// Middleware para rutas no encontradas
app.use((req, res) => {
    Logger.warn('Ruta no encontrada', { 
        metodo: req.method, 
        ruta: req.path,
        session: req.sessionID ? 'Activa' : 'No activa'
    });
    
    // Si es una API, devolver JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
            success: false, 
            message: 'Ruta no encontrada',
            path: req.path
        });
    }
    
    // Si es una página, servir 404.html si existe, o redirigir al dashboard
    const notFoundPage = path.join(__dirname, 'public', '404.html');
    if (require('fs').existsSync(notFoundPage)) {
        res.status(404).sendFile(notFoundPage);
    } else {
        res.redirect('/dashboard');
    }
});

// Middleware para manejo de errores
app.use((error, req, res, next) => {
    Logger.error('Error no manejado en la aplicación', {
        error: error.message,
        ruta: req.path,
        usuario: req.session?.user?.nombre || 'No autenticado',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    // Si es una API, devolver JSON
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    
    // Si es una página, servir error page o redirigir
    const errorPage = path.join(__dirname, 'public', 'error.html');
    if (require('fs').existsSync(errorPage)) {
        res.status(500).sendFile(errorPage);
    } else {
        res.status(500).send(`
            <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: #e74c3c;">Error del Servidor</h2>
                <p>Ha ocurrido un error interno. Por favor, intenta más tarde.</p>
                <a href="/dashboard">Volver al Dashboard</a>
            </body>
            </html>
        `);
    }
});

// ==============================================
// INICIAR EL SERVIDOR
// ==============================================

// ==============================================
// VALIDACIÓN DE CONEXIÓN A BD ANTES DE INICIAR
// ==============================================
async function validateDatabaseConnection() {
    try {
        const result = await databaseConfig.queryAsync('SELECT NOW()');
        console.log('✅ Conexión a PostgreSQL verificada exitosamente');
        return true;
    } catch (err) {
        console.error('❌ ERROR: No se puede conectar a la base de datos');
        console.error('Error:', err.message);
        console.error('\n📋 Verifica las variables de entorno:');
        console.error('   - DATABASE_URL (para Railway)');
        console.error('   - O: DB_USER, DB_HOST, DB_PASSWORD, DB_PORT, DB_NAME');
        return false;
    }
}

const PORT = process.env.PORT || 3000;

// Verificar configuración crítica antes de iniciar
function validateConfig() {
    const requiredEnvVars = [
        'SESSION_SECRET',
        'JWT_SECRET',
        'ADMIN_REGISTER_SECRET'
    ];
    
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
        console.warn('⚠️  Advertencia: Variables de entorno faltantes:', missing.join(', '));
        console.log('🔑 Usando valores por defecto para desarrollo');
    } else {
        console.log('✅ Todas las variables de entorno críticas están configuradas');
    }
}

app.listen(PORT, async () => {
    // Validar conexión a BD primero
    const dbConnected = await validateDatabaseConnection();
    
    if (!dbConnected) {
        console.error('\n⚠️  ADVERTENCIA: La aplicación está corriendo pero sin conexión a BD');
        console.error('Las rutas que requieren BD fallarán hasta que se resuelva la conexión\n');
    }
    
    validateConfig();
    
    Logger.startup(PORT, process.env.NODE_ENV || 'development');
    console.log('🔐 Sistema de roles y autenticación activado');
    console.log('👑 Ruta de administración: /api/admin/*');
    console.log('🔒 Middleware de autenticación JWT configurado');
    console.log('🔑 Ruta de registro de administradores: /admin-register');
     console.log('🔄 Sistema MULTI-USUARIO de asistencias activado');
    console.log('📊 Nuevo sistema de asistencias:');
    console.log('   - TODOS los usuarios pueden registrar para otros');
    console.log('   - Solo ADMIN pueden ver reportes completos');
    console.log('   - Registro de quién realizó cada registro');
    console.log('   - Selector de usuarios disponible para todos');
    console.log('🔄 Sistema de gestión de usuarios en página principal activado');
    console.log('📊 Nuevas rutas de administración:');
    console.log('   - GET /api/admin/usuarios/lista');
    console.log('   - PUT /api/admin/usuarios/:id/rol');
    console.log('   - DELETE /api/admin/usuarios/:id');
    console.log('📸 Sistema de asistencias MULTI-USUARIO activado');
    console.log('   - POST /api/asistencias/registrar-multi (solo admin)');
    console.log('   - POST /api/asistencias/registrar');
    console.log('   - GET /api/asistencias/reporte (solo admin ve todos)');
    console.log('   - GET /api/asistencias/mis-asistencias (para todos)');
    console.log('   - GET /api/usuarios/activos (para selector multi-usuario)');
    console.log('   - GET /api/asistencias/dashboard-estadisticas (diferenciado por rol)');
    console.log('===============================================');
    console.log(`🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
    console.log('===============================================');
});