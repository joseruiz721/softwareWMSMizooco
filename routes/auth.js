const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const databaseConfig = require('../config/database');
const { enviarCorreoRecuperacion, enviarCorreoConfirmacion } = require('../config/email');
const path = require('path');
const { authenticateToken, requireAdmin, optionalToken, checkAuthStatus } = require('../middleware/auth');

const router = express.Router();

// ==============================================
// RUTAS DE PÁGINAS
// ==============================================

// Función auxiliar para verificar token y servir página
async function serveResetPage(req, res) {
    const { token } = req.params;
    console.log('📄 Verificando token para página de restablecimiento:', token);
    console.log('🔍 Longitud del token:', token.length);
    
    try {
        // PRIMERO: Debug - ver todos los tokens en BD
        const allTokens = await databaseConfig.queryAsync(
            `SELECT prt.id, u.correo, prt.token, prt.expires_at, prt.used, NOW() as ahora 
             FROM password_reset_tokens prt 
             JOIN usuarios u ON prt.user_id = u.id 
             WHERE prt.used = false`
        );
        
        console.log('🔍 Tokens en BD:', allTokens.map(t => ({
            correo: t.correo,
            token: t.token ? `${t.token.substring(0, 20)}...` : 'NULL',
            expira: t.expires_at,
            usado: t.used,
            ahora: t.ahora
        })));
        
        // LUEGO: Verificar el token específico
        const rows = await databaseConfig.queryAsync(
            `SELECT u.id, u.nombre, u.correo, prt.token, prt.expires_at, prt.used, NOW() as ahora 
             FROM password_reset_tokens prt 
             JOIN usuarios u ON prt.user_id = u.id 
             WHERE prt.token = $1 AND prt.used = false`,
            [token]
        );
        
        console.log('🔍 Resultado de búsqueda de token:', {
            encontrado: rows.length > 0,
            usuario: rows[0]?.nombre,
            token_en_bd: rows[0]?.token ? '✓' : '✗',
            expira: rows[0]?.expires_at,
            usado: rows[0]?.used,
            ahora: rows[0]?.ahora,
            expirado: rows[0]?.expires_at < rows[0]?.ahora
        });

        if (rows.length === 0) {
            console.log('❌ Token no encontrado en BD');
            // ... mostrar error page
        }
        
        // Verificar expiración
        if (rows[0].expires_at < rows[0].ahora) {
            console.log('❌ Token expirado');
            // ... mostrar error page
        }
        
        console.log('✅ Token válido, sirviendo página para:', rows[0].nombre);
        res.sendFile(path.join(__dirname, '../public/reestablecer-contraseña.html'));
        
    } catch (error) {
        console.error("❌ Error verificando token:", error);
        return res.status(500).send("Error interno del servidor.");
    }
}

// Ruta para página de restablecimiento (sin codificar)
router.get("/reestablecer-contraseña/:token", async (req, res) => {
    await serveResetPage(req, res);
});

// Ruta para página de restablecimiento (codificada)
router.get("/reestablecer-contrase%C3%B1a/:token", async (req, res) => {
    await serveResetPage(req, res);
});

// Ruta para servir la página de solicitud de reset
router.get("/solicitar-reset", (req, res) => {
    console.log('📄 Sirviendo página de recuperación de contraseña');
    res.sendFile(path.join(__dirname, '../public/solicitar_reset.html'));
});

// ==============================================
// RUTAS DE AUTENTICACIÓN
// ==============================================

// Login de usuarios
router.post("/login", async (req, res) => {
    const { correo, pass, remember } = req.body;
    
    console.log('🔐 Intento de login para:', correo);
    
    if (!correo || !pass) {
        console.log('❌ Campos faltantes');
        return res.status(400).json({ 
            success: false, 
            message: "Correo y contraseña son obligatorios." 
        });
    }
    
    try {
        const rows = await databaseConfig.queryAsync(
            "SELECT * FROM usuarios WHERE correo = $1", 
            [correo]
        );
        
        if (rows.length === 0) {
            console.log('❌ Usuario no encontrado:', correo);
            return res.status(404).json({ 
                success: false, 
                message: "Usuario no encontrado." 
            });
        }
        
        const usuario = rows[0];
        console.log('✅ Usuario encontrado:', usuario.nombre, '- Rol:', usuario.role);
        console.log('🔍 Hash de contraseña en BD (primeros 20 chars):', usuario.contrasena ? usuario.contrasena.substring(0, 20) + '...' : 'NULL');
        
        // 🔥 VERIFICAR SI EL USUARIO ESTÁ BLOQUEADO
        if (usuario.estado === 'bloqueado') {
            console.log('🚫 Usuario bloqueado intentando acceder:', usuario.nombre);
            return res.status(403).json({ 
                success: false, 
                message: "Tu cuenta ha sido bloqueada. Contacta al administrador." 
            });
        }
        
        if (!usuario.contrasena) {
            console.error('❌ Usuario sin contraseña hash:', usuario.correo);
            return res.status(500).json({ 
                success: false, 
                message: "Error en la configuración del usuario." 
            });
        }
        
        const match = await bcrypt.compare(pass, usuario.contrasena);
        
        if (!match) {
            console.log('❌ Contraseña incorrecta para:', correo);
            return res.status(401).json({ 
                success: false, 
                message: "Contraseña incorrecta." 
            });
        }
        
        // Configurar sesión
        const userSessionData = {
            id: usuario.id,
            cedula: usuario.cedula,
            nombre: usuario.nombre,
            correo: usuario.correo,
            role: usuario.role,
            fecha_registro: usuario.fecha_registro,
            estado: usuario.estado || 'activo' // 🔥 Incluir estado en sesión
        };
        
        // Guardar la sesión tanto con el objeto user como con userId para compatibilidad
        req.session.user = userSessionData;
        req.session.userId = usuario.id;
        
        // Si el usuario solicitó 'recordar sesión', ampliar la duración de la cookie y del token
        const rememberFlag = !!remember;
        if (rememberFlag) {
            // Establecer cookie persistente por 30 días
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 días
        } else {
            // Mantener comportamiento por defecto (24 horas)
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 horas
        }

        // Generar token JWT (más largo si recuerda)
        const tokenExpiry = rememberFlag ? '30d' : '24h';
        const token = jwt.sign(
            { userId: usuario.id },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: tokenExpiry }
        );
        
        console.log('✅ Credenciales correctas para:', usuario.nombre, '- Rol:', usuario.role, '- Estado:', usuario.estado || 'activo');
        
        // Guardar sesión
        req.session.save((err) => {
            if (err) {
                console.error('❌ Error al guardar sesión:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: "Error al iniciar sesión."
                });
            }
            
            console.log('✅ Sesión guardada exitosamente');
            console.log('🔒 session.cookie.maxAge =', req.session.cookie.maxAge);
            
            // Nota: se incluye temporalmente sessionMaxAge en la respuesta para verificación
            return res.json({ 
                success: true, 
                message: "Login exitoso",
                redirect: "/dashboard",
                user: userSessionData,
                token: token,
                sessionMaxAge: req.session.cookie.maxAge
            });
        });
        
    } catch (error) {
        console.error("❌ Error en DB en /login:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error en la base de datos." 
        });
    }
});

// Cerrar sesión
router.post("/logout", (req, res) => {
    console.log('🚪 Solicitando logout para usuario:', req.session.user?.nombre || 'Usuario desconocido');
    
    const userName = req.session.user?.nombre || 'Usuario desconocido';
    
    res.clearCookie('connect.sid');
    
    req.session.destroy((err) => {
        if (err) {
            console.error("❌ Error al destruir sesión:", err);
            return res.status(500).json({ 
                success: false, 
                message: "Error interno al cerrar sesión." 
            });
        }
        
        console.log('✅ Sesión cerrada para:', userName);
        
        res.json({ 
            success: true, 
            message: "Sesión cerrada exitosamente.",
            redirect: "/",
            clearToken: true
        });
    });
});

// Registro de usuarios
router.post("/registro", async (req, res) => {
    const { ced, nom, correo, pass, role = 'user' } = req.body;

    console.log('👤 Intento de registro para:', correo, '- Rol solicitado:', role);

    if (!ced || !nom || !correo || !pass) {
        return res.status(400).json({ 
            success: false, 
            message: "Todos los campos son obligatorios." 
        });
    }

    try {
        const rows = await databaseConfig.queryAsync(
            "SELECT * FROM usuarios WHERE cedula = $1 OR correo = $2", 
            [ced, correo]
        );
        
        if (rows.length > 0) {
            console.log('❌ Usuario ya existe:', correo);
            return res.status(409).json({ 
                success: false, 
                message: "El usuario ya existe." 
            });
        }

        let finalRole = 'user';
        if (role === 'admin') {
            const adminSecret = req.body.adminSecret || '';
            const validSecret = process.env.ADMIN_REGISTER_SECRET || 'clave-secreta-admin-2024';
            
            if (adminSecret === validSecret) {
                finalRole = 'admin';
                console.log('👑 Creando cuenta de administrador para:', correo);
            } else {
                console.log('❌ Clave secreta inválida para registro admin');
                return res.status(403).json({ 
                    success: false, 
                    message: "Clave secreta inválida para registro de administrador." 
                });
            }
        }

        const hashedPassword = await bcrypt.hash(pass, 10);
        
        const result = await databaseConfig.queryAsync(
            "INSERT INTO usuarios (cedula, nombre, correo, contrasena, role, fecha_registro, estado) VALUES ($1, $2, $3, $4, $5, NOW(), 'activo') RETURNING id, cedula, nombre, correo, role, fecha_registro, estado",
            [ced, nom, correo, hashedPassword, finalRole]
        );

        const newUser = result[0];
        console.log('✅ Usuario registrado exitosamente, ID:', newUser.id, '- Rol:', newUser.role, '- Estado:', newUser.estado);

        return res.json({ 
            success: true, 
            message: `Usuario ${finalRole} registrado exitosamente`,
            user: {
                id: newUser.id,
                cedula: newUser.cedula,
                nombre: newUser.nombre,
                correo: newUser.correo,
                role: newUser.role,
                fecha_registro: newUser.fecha_registro,
                estado: newUser.estado
            },
            redirect: "/"
        });

    } catch (error) {
        console.error("❌ Error en registro:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error al registrar usuario." 
        });
    }
});

// REGISTRO DE ADMINISTRADORES
router.post("/registro-admin", async (req, res) => {
    try {
        const { ced, nom, correo, pass, role = 'admin', adminSecret } = req.body;

        console.log('👑 Intento de registro de administrador para:', correo);

        const validSecret = process.env.ADMIN_REGISTER_SECRET || 'clave-secreta-admin-2024';
        if (adminSecret !== validSecret) {
            console.log('❌ Clave secreta inválida para registro admin');
            return res.json({
                success: false,
                message: 'Clave secreta inválida para registro de administradores'
            });
        }

        if (!ced || !nom || !correo || !pass) {
            return res.json({
                success: false,
                message: 'Todos los campos son obligatorios'
            });
        }

        if (pass.length < 6) {
            return res.json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres'
            });
        }

        if (!['admin', 'superadmin'].includes(role)) {
            return res.json({
                success: false,
                message: 'Rol inválido para administrador'
            });
        }

        const existingUser = await databaseConfig.queryAsync(
            "SELECT id FROM usuarios WHERE correo = $1 OR cedula = $2",
            [correo, ced]
        );

        if (existingUser.length > 0) {
            return res.json({
                success: false,
                message: 'El correo o cédula ya están registrados'
            });
        }

        const hashedPassword = await bcrypt.hash(pass, 10);
        
        const result = await databaseConfig.queryAsync(
            "INSERT INTO usuarios (cedula, nombre, correo, contrasena, role, fecha_registro, estado) VALUES ($1, $2, $3, $4, $5, NOW(), 'activo') RETURNING id, cedula, nombre, correo, role, fecha_registro, estado",
            [ced, nom, correo, hashedPassword, role]
        );

        const newAdmin = result[0];
        console.log('✅ Administrador registrado exitosamente:', newAdmin.nombre, '- Rol:', newAdmin.role, '- Estado:', newAdmin.estado);

        res.json({
            success: true,
            message: `Administrador ${role} registrado exitosamente`,
            user: {
                id: newAdmin.id,
                cedula: newAdmin.cedula,
                nombre: newAdmin.nombre,
                correo: newAdmin.correo,
                role: newAdmin.role,
                fecha_registro: newAdmin.fecha_registro,
                estado: newAdmin.estado
            }
        });

    } catch (error) {
        console.error('❌ Error en registro de administrador:', error);
        res.json({
            success: false,
            message: 'Error interno del servidor en el registro de administrador'
        });
    }
});

// ==============================================
// RECUPERACIÓN DE CONTRASEÑA
// ==============================================

router.post('/solicitar-reset', async (req, res) => {
    const { correo } = req.body;
    console.log('🔑 Solicitando reset para:', correo);
    
    try {
        if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            return res.status(400).json({ 
                success: false, 
                message: "Por favor, proporciona un correo electrónico válido." 
            });
        }

        const rows = await databaseConfig.queryAsync(
            "SELECT id, nombre, correo, estado FROM usuarios WHERE correo = $1", 
            [correo]
        );
        
        if (rows.length === 0) {
            console.log('📧 Email no encontrado (por seguridad):', correo);
            return res.json({ 
                success: true, 
                message: "Si existe una cuenta con ese correo, se ha enviado un enlace para restablecer la contraseña." 
            });
        }
        
        const usuario = rows[0];
        
        // VERIFICAR SI EL USUARIO ESTÁ BLOQUEADO
        if (usuario.estado === 'bloqueado') {
            console.log('🚫 Usuario bloqueado intentando recuperar contraseña:', usuario.nombre);
            return res.json({ 
                success: false, 
                message: "Tu cuenta está bloqueada. Contacta al administrador para recuperar el acceso." 
            });
        }
        
        // Generar token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000);
        
        console.log('🔐 Token generado:', {
            token: token.substring(0, 20) + '...',
            expira: expires,
            expiraISO: expires.toISOString()
        });

        // Guardar token en BD
        const result = await databaseConfig.queryAsync(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING id, token, expires_at",
            [usuario.id, token, expires.toISOString()]
        );

        // Verificar que se guardó
        if (result.length === 0 || result[0].token !== token) {
            console.error('❌ Error: Token no se guardó correctamente en BD');
            throw new Error('Error al guardar token de recuperación');
        }

        console.log('✅ Token guardado correctamente en BD para:', usuario.correo);
        console.log('📅 Expira:', result[0].expires_at);

        // Crear enlace
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reestablecer-contraseña/${token}`;
        console.log('🔗 Enlace de restablecimiento:', resetLink);

        // Enviar email (con manejo de errores mejorado)
        let emailSent = false;
        try {
            const emailResult = await enviarCorreoRecuperacion(usuario.correo, usuario.nombre, resetLink);
            
            if (emailResult.success) {
                console.log('✅ Email de recuperación enviado a:', usuario.correo);
                emailSent = true;
            } else {
                console.error('❌ Error enviando email:', emailResult.error);
                // No hacemos rollback aquí, el token queda válido por si el usuario solicita otro email
            }
        } catch (emailError) {
            console.error('❌ Error en envío de email:', emailError);
            // El token sigue siendo válido
        }
        
        return res.json({ 
            success: true, 
            message: "Si existe una cuenta con ese correo, se ha enviado un enlace para restablecer la contraseña.",
            debug_link: process.env.NODE_ENV === 'development' ? resetLink : undefined,
            email_sent: emailSent
        });

    } catch (error) {
        console.error("❌ Error en /solicitar-reset:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error interno del servidor. Por favor, intenta más tarde." 
        });
    }
});

// Reestablecer contraseña
router.post('/reestablecer-pass', async (req, res) => {
    const { token, password } = req.body;

    console.log('🔑 Restableciendo contraseña con token');
    console.log('📝 Contraseña recibida del frontend (longitud):', password ? password.length : 'NULL');
    console.log('📝 Primeros 10 chars de contraseña:', password ? password.substring(0, 10) + '...' : 'NULL');
    console.log('📝 Contraseña recibida del frontend (longitud):', password ? password.length : 'NULL');
    console.log('📝 Primeros 10 chars de contraseña:', password ? password.substring(0, 10) + '...' : 'NULL');

    if (!token) {
        return res.status(400).json({ 
            success: false, 
            message: "Token de restablecimiento requerido." 
        });
    }

    if (!password || password.length < 8) {
        return res.status(400).json({ 
            success: false, 
            message: "La contraseña debe tener al menos 8 caracteres." 
        });
    }

    const requirements = {
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };

    if (!requirements.uppercase || !requirements.lowercase || !requirements.number || !requirements.special) {
        return res.status(400).json({
            success: false,
            message: "La contraseña debe contener mayúsculas, minúsculas, números y caracteres especiales."
        });
    }

    try {
        const rows = await databaseConfig.queryAsync(
            `SELECT prt.id as token_id, u.id, u.nombre, u.correo, u.estado 
             FROM password_reset_tokens prt 
             JOIN usuarios u ON prt.user_id = u.id 
             WHERE prt.token = $1 AND prt.expires_at > NOW() AND prt.used = false`,
            [token]
        );

        if (rows.length === 0) {
            console.log('❌ Token inválido o expirado:', token);
            return res.status(400).json({ 
                success: false, 
                message: "El enlace de restablecimiento es inválido o ha expirado." 
            });
        }

        const usuario = rows[0];
        console.log('👤 Usuario encontrado para reset:', {
            id: usuario.id,
            nombre: usuario.nombre,
            correo: usuario.correo,
            token_id: usuario.token_id
        });
        
        // 🔥 VERIFICAR SI EL USUARIO ESTÁ BLOQUEADO
        if (usuario.estado === 'bloqueado') {
            console.log('🚫 Usuario bloqueado intentando restablecer contraseña:', usuario.nombre);
            return res.status(403).json({ 
                success: false, 
                message: "Tu cuenta está bloqueada. No puedes restablecer la contraseña." 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 12);
        console.log('🔐 Contraseña hasheada correctamente, longitud:', hashedPassword.length);
        console.log('🔐 Hash generado (primeros 20 chars):', hashedPassword.substring(0, 20) + '...');

        // Solución: Deshabilitar triggers temporalmente para el UPDATE
        console.log('🔄 Deshabilitando triggers...');
        await databaseConfig.pool.query("ALTER TABLE usuarios DISABLE TRIGGER trigger_sync_estado");
        await databaseConfig.pool.query("ALTER TABLE usuarios DISABLE TRIGGER trigger_limpiar_eliminados");
        
        console.log('🔄 Ejecutando UPDATE sin triggers...');
        const updateResult = await databaseConfig.pool.query(
            "UPDATE usuarios SET contrasena = $1 WHERE id = $2",
            [hashedPassword, usuario.id]
        );
        console.log('💾 UPDATE sin triggers ejecutado, rowCount:', updateResult.rowCount);

        // Re-habilitar triggers
        console.log('🔄 Re-habilitando triggers...');
        await databaseConfig.pool.query("ALTER TABLE usuarios ENABLE TRIGGER trigger_sync_estado");
        await databaseConfig.pool.query("ALTER TABLE usuarios ENABLE TRIGGER trigger_limpiar_eliminados");

        // Verificar el resultado
        const verifyResult = await databaseConfig.queryAsync(
            "SELECT id, correo, contrasena FROM usuarios WHERE id = $1",
            [usuario.id]
        );
        console.log('🔍 Verificación final:', {
            id: verifyResult[0]?.id,
            correo: verifyResult[0]?.correo,
            hash_actual: verifyResult[0]?.contrasena ? verifyResult[0].contrasena.substring(0, 20) + '...' : 'NULL',
            es_hash_nuevo: verifyResult[0]?.contrasena === hashedPassword
        });

        if (updateResult.rowCount === 0) {
            console.error('❌ Error: UPDATE no afectó ninguna fila');
            throw new Error('Error al actualizar contraseña');
        }

        if (verifyResult[0]?.contrasena !== hashedPassword) {
            console.error('❌ Error: El hash no se guardó correctamente en BD');
            throw new Error('Error al guardar la nueva contraseña');
        }
        const hashRetornado = updateResult.rows[0]?.contrasena;
        const hashVerificado = verifyResult[0]?.contrasena;
        const hashesIguales = hashRetornado === hashVerificado;
        const hashCorrecto = hashRetornado === hashedPassword;

        console.log('🔍 Comparación de hashes:', {
            hash_generado_correcto: hashCorrecto,
            hash_retornado_vs_verificado: hashesIguales,
            problema: !hashCorrecto ? 'El UPDATE no guardó el hash correcto' : 
                     !hashesIguales ? 'Inconsistencia entre RETURNING y SELECT' : 'OK'
        });

        console.log('✅ Contraseña actualizada exitosamente para usuario:', verifyResult[0].correo);
        const tokenUpdateResult = await databaseConfig.queryAsync(
            "UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE id = $1 RETURNING id",
            [usuario.token_id]
        );
        console.log('🔑 Resultado de marcado de token como usado:', tokenUpdateResult);

        console.log('✅ Contraseña actualizada para:', usuario.correo);

        try {
            await enviarCorreoConfirmacion(usuario.correo, usuario.nombre);
        } catch (emailError) {
            console.error('❌ Error enviando email de confirmación:', emailError);
        }

        return res.json({ 
            success: true, 
            message: "¡Contraseña actualizada con éxito! Ya puedes iniciar sesión." 
        });

    } catch (error) {
        console.error("❌ Error al guardar la nueva contraseña:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error interno del servidor. Por favor, intenta más tarde." 
        });
    }
});

// ==============================================
// 🔐 RUTAS PARA GESTIÓN DE USUARIOS (SOLO ADMIN)
// ==============================================

// Endpoint para verificar token y obtener datos de usuario
router.get("/verify", authenticateToken, async (req, res) => {
    try {
        return res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error("Error verificando token:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error al verificar autenticación." 
        });
    }
});

// Endpoint para verificar estado de autenticación
router.get("/auth-status", checkAuthStatus, async (req, res) => {
    try {
        return res.json({
            success: true,
            authenticated: req.authStatus.authenticated,
            user: req.authStatus.user,
            method: req.authStatus.method
        });
    } catch (error) {
        console.error("Error verificando estado de autenticación:", error);
        return res.json({
            success: false,
            authenticated: false,
            user: null,
            method: 'none'
        });
    }
});

// Endpoint para obtener todos los usuarios (solo admin)
router.get("/usuarios", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await databaseConfig.queryAsync(
            "SELECT id, cedula, nombre, correo, role, fecha_registro, estado FROM usuarios ORDER BY fecha_registro DESC"
        );
        
        return res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error("❌ Error obteniendo usuarios:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener usuarios.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Endpoint para cambiar rol de usuario (solo admin)
router.put("/usuarios/:id/role", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Rol inválido. Debe ser 'user' o 'admin'."
            });
        }

        if (parseInt(id) === req.user.id) {
            return res.status(403).json({
                success: false,
                message: "No puedes cambiar tu propio rol."
            });
        }

        const userExists = await databaseConfig.queryAsync(
            "SELECT id, nombre FROM usuarios WHERE id = $1", 
            [id]
        );
        
        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        await databaseConfig.queryAsync(
            "UPDATE usuarios SET role = $1 WHERE id = $2", 
            [role, id]
        );

        console.log(`👑 Rol actualizado: Usuario ${userExists[0].nombre} (${id}) ahora es ${role}`);

        return res.json({
            success: true,
            message: `Rol actualizado a ${role} correctamente.`
        });

    } catch (error) {
        console.error("❌ Error actualizando rol:", error);
        return res.status(500).json({
            success: false,
            message: "Error al actualizar rol.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Endpoint para cambiar estado de usuario (bloquear/activar)
router.put("/usuarios/:id/estado", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!estado || !['activo', 'bloqueado'].includes(estado)) {
            return res.status(400).json({
                success: false,
                message: "Estado inválido. Debe ser 'activo' o 'bloqueado'."
            });
        }

        if (parseInt(id) === req.user.id) {
            return res.status(403).json({
                success: false,
                message: "No puedes cambiar tu propio estado."
            });
        }

        const userExists = await databaseConfig.queryAsync(
            "SELECT id, nombre, correo FROM usuarios WHERE id = $1", 
            [id]
        );
        
        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        await databaseConfig.queryAsync(
            "UPDATE usuarios SET estado = $1 WHERE id = $2", 
            [estado, id]
        );

        const usuario = userExists[0];
        console.log(`🔐 Estado actualizado: Usuario ${usuario.nombre} (${id}) ahora está ${estado}`);

        // Si se bloquea un usuario, destruir cualquier sesión activa
        if (estado === 'bloqueado') {
            // Aquí podrías agregar lógica para invalidar tokens JWT activos si los tiene
            console.log(`🚫 Usuario ${usuario.nombre} bloqueado - Se recomienda invalidar tokens activos`);
        }

        return res.json({
            success: true,
            message: `Estado actualizado a ${estado} correctamente.`,
            user: {
                id: usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                estado: estado
            }
        });

    } catch (error) {
        console.error("❌ Error actualizando estado:", error);
        return res.status(500).json({
            success: false,
            message: "Error al actualizar estado.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Endpoint para eliminar usuario (solo admin)
router.delete("/usuarios/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🗑️ Intentando eliminar usuario ID: ${id} por administrador: ${req.user?.nombre || 'Unknown'}`);

        // Verificar que el ID sea válido
        if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID de usuario inválido."
            });
        }

        const userId = parseInt(id);

        if (userId === req.user.id) {
            return res.status(403).json({
                success: false,
                message: "No puedes eliminar tu propia cuenta."
            });
        }

        // Verificar si el usuario existe
        const userExists = await databaseConfig.queryAsync(
            "SELECT id, nombre, role, estado FROM usuarios WHERE id = $1", 
            [userId]
        );
        
        if (userExists.length === 0) {
            console.log(`❌ Usuario con ID ${userId} no encontrado`);
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        const usuario = userExists[0];

        // Si el usuario ya está marcado como eliminado
        if (usuario.estado === 'eliminado') {
            return res.status(400).json({
                success: false,
                message: "Este usuario ya ha sido eliminado anteriormente."
            });
        }

        // Si es administrador, verificar que no sea el único admin activo
        if (usuario.role === 'admin') {
            const adminCount = await databaseConfig.queryAsync(
                "SELECT COUNT(*) as count FROM usuarios WHERE role = 'admin' AND estado != 'eliminado' AND id != $1",
                [userId]
            );
            
            if (parseInt(adminCount[0].count) < 1) {
                return res.status(403).json({
                    success: false,
                    message: "No puedes eliminar la única cuenta de administrador activa del sistema."
                });
            }
        }

        // Verificar si el usuario tiene datos relacionados (opcional, depende de tus requerimientos)
        try {
            // Puedes agregar verificaciones aquí para tablas relacionadas
            // Ejemplo: verificar si tiene registros en otras tablas
            
            // Si necesitas prevenir eliminación si tiene datos relacionados:
            /*
            const tieneAsistencias = await databaseConfig.queryAsync(
                "SELECT COUNT(*) as count FROM asistencias WHERE usuario_id = $1",
                [userId]
            );
            
            if (parseInt(tieneAsistencias[0].count) > 0) {
                return res.status(400).json({
                    success: false,
                    message: "No se puede eliminar el usuario porque tiene registros de asistencias."
                });
            }
            */
            
        } catch (relationError) {
            console.warn('⚠️ Error verificando relaciones del usuario:', relationError.message);
            // Continuar con la eliminación incluso si hay error en las verificaciones
        }

        // Usar eliminación lógica (marcar como eliminado) en lugar de DELETE físico
        await databaseConfig.queryAsync(
            "UPDATE usuarios SET estado = 'eliminado', correo = CONCAT(correo, '_eliminado_', EXTRACT(EPOCH FROM NOW())) WHERE id = $1", 
            [userId]
        );

        console.log(`✅ Usuario ${usuario.nombre} (ID: ${userId}) marcado como eliminado por administrador ${req.user?.nombre || 'Unknown'}`);

        return res.json({
            success: true,
            message: "Usuario eliminado correctamente.",
            data: {
                id: userId,
                nombre: usuario.nombre,
                estado: 'eliminado'
            }
        });

    } catch (error) {
        console.error("❌ Error eliminando usuario:", error);
        return res.status(500).json({
            success: false,
            message: "Error al eliminar usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Endpoint para obtener estadísticas de usuarios (solo admin)
router.get("/estadisticas", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await databaseConfig.queryAsync(`
            SELECT 
                COUNT(*) as total_usuarios,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins,
                COUNT(CASE WHEN role = 'user' THEN 1 END) as total_users,
                COUNT(CASE WHEN estado = 'activo' THEN 1 END) as usuarios_activos,
                COUNT(CASE WHEN estado = 'bloqueado' THEN 1 END) as usuarios_bloqueados,
                MIN(fecha_registro) as primer_registro,
                MAX(fecha_registro) as ultimo_registro
            FROM usuarios
            WHERE estado != 'eliminado'
        `);
        
        return res.json({
            success: true,
            data: stats[0]
        });
    } catch (error) {
        console.error("❌ Error obteniendo estadísticas:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener estadísticas.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;