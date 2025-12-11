const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryAsync } = require('../utils/queryAsync');
const { authenticateToken, requireAdmin, requireRole } = require('../middleware/auth');

const router = express.Router();

// Registro de usuarios
router.post("/registro", async (req, res) => {
    const { ced, nom, correo, pass, role = 'user' } = req.body;

    if (!ced || !nom || !correo || !pass) {
        return res.status(400).json({ 
            success: false, 
            message: "Todos los campos son obligatorios." 
        });
    }

    try {
        // Verificar si el usuario ya existe
        const rows = await queryAsync(
            "SELECT * FROM usuarios WHERE cedula = $1 OR correo = $2", 
            [ced, correo]
        );
        
        if (rows.length > 0) {
            return res.status(409).json({ 
                success: false, 
                message: "El usuario ya existe." 
            });
        }

        // Validar rol de administrador
        let finalRole = 'user';
        if (role === 'admin') {
            if (req.body.adminSecret === process.env.ADMIN_SECRET) {
                finalRole = 'admin';
                console.log('👑 Creando cuenta de administrador para:', correo);
            } else {
                return res.status(403).json({ 
                    success: false, 
                    message: "No autorizado para crear cuenta de administrador." 
                });
            }
        }

        const hashedPassword = await bcrypt.hash(pass, 10);
        
        // Incluir campo role en el INSERT
        const result = await queryAsync(
            "INSERT INTO usuarios (cedula, nombre, correo, contrasena, role, estado, activo) VALUES ($1, $2, $3, $4, $5, 'activo', true) RETURNING id, cedula, nombre, correo, role, estado",
            [ced, nom, correo, hashedPassword, finalRole]
        );

        const newUser = result[0];

        return res.json({ 
            success: true, 
            message: `Usuario ${finalRole} registrado exitosamente`,
            user: {
                id: newUser.id,
                cedula: newUser.cedula,
                nombre: newUser.nombre,
                correo: newUser.correo,
                role: newUser.role,
                estado: newUser.estado
            },
            redirect: "/index.html" 
        });

    } catch (error) {
        console.error("Error en registro:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error al registrar usuario." 
        });
    }
});

// Login mejorado con verificación de estado
router.post("/login", async (req, res) => {
    const { correo, pass } = req.body;

    if (!correo || !pass) {
        return res.status(400).json({ 
            success: false, 
            message: "Correo y contraseña son obligatorios." 
        });
    }

    try {
        // Buscar usuario incluyendo el rol y estado
        const rows = await queryAsync(
            "SELECT * FROM usuarios WHERE correo = $1", 
            [correo]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: "Credenciales inválidas." 
            });
        }

        const usuario = rows[0];
        
        // Verificar contraseña
        const passwordMatch = await bcrypt.compare(pass, usuario.contrasena);
        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false, 
                message: "Credenciales inválidas." 
            });
        }

        // Verificar estado del usuario
        if (usuario.estado === 'suspendido') {
            let mensaje = "Tu cuenta está suspendida.";
            
            // Verificar si hay fecha de expiración
            if (usuario.fecha_expiracion_suspension) {
                const expiracion = new Date(usuario.fecha_expiracion_suspension);
                if (expiracion > new Date()) {
                    mensaje += ` La suspensión expira el ${expiracion.toLocaleDateString()}.`;
                } else {
                    mensaje += " La suspensión ha expirado. Contacta al administrador.";
                }
            }
            
            return res.status(403).json({ 
                success: false, 
                message: mensaje,
                estado: 'suspendido'
            });
        }
        
        if (usuario.estado === 'bloqueado') {
            return res.status(403).json({ 
                success: false, 
                message: "Tu cuenta ha sido bloqueada permanentemente. Contacta al administrador.",
                estado: 'bloqueado'
            });
        }
        
        if (!usuario.activo || usuario.estado !== 'activo') {
            return res.status(403).json({ 
                success: false, 
                message: "Tu cuenta está inactiva.",
                estado: 'inactivo'
            });
        }

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: usuario.id,
                role: usuario.role,
                nombre: usuario.nombre 
            },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        // Configurar sesión
        req.session.user = {
            id: usuario.id,
            cedula: usuario.cedula,
            nombre: usuario.nombre,
            correo: usuario.correo,
            role: usuario.role,
            estado: usuario.estado
        };

        console.log(`✅ Login exitoso: ${usuario.nombre} (${usuario.role}) - Estado: ${usuario.estado}`);

        return res.json({
            success: true,
            message: "Login exitoso",
            user: {
                id: usuario.id,
                cedula: usuario.cedula,
                nombre: usuario.nombre,
                correo: usuario.correo,
                role: usuario.role,
                estado: usuario.estado
            },
            token: token,
            redirect: "/paginaPrincipal.html"
        });

    } catch (error) {
        console.error("Error en login:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error al iniciar sesión." 
        });
    }
});

// Verificar token
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

// Obtener perfil de usuario
router.get("/perfil", async (req, res) => {
    try {
        if (!req.session?.user?.id) {
            return res.status(401).json({ 
                success: false, 
                message: "No autorizado. Inicie sesión nuevamente." 
            });
        }

        const rows = await queryAsync(
            "SELECT id, cedula, nombre, correo, role, estado, fecha_registro FROM usuarios WHERE id = $1", 
            [req.session.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Usuario no encontrado." 
            });
        }
        
        const usuario = rows[0];
        
        return res.json({
            success: true,
            data: {
                ...usuario,
                fecha_registro: new Date(usuario.fecha_registro).toISOString()
            }
        });

    } catch (error) {
        console.error("Error al obtener perfil:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error interno del servidor",
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
});

// Actualizar perfil de usuario
router.put("/perfil", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { nombre, cedula, correo, contrasena, role } = req.body;

        console.log(`✏️ Actualizando perfil del usuario ID: ${userId}`, req.body);

        if (!nombre && !cedula && !correo && !contrasena && !role) {
            return res.status(400).json({
                success: false,
                message: "No se proporcionaron datos para actualizar."
            });
        }

        // Verificar permisos para cambiar rol
        if (role) {
            const currentUser = await queryAsync(
                "SELECT role FROM usuarios WHERE id = $1",
                [userId]
            );
            
            if (currentUser[0].role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: "Solo los administradores pueden cambiar roles de usuario."
                });
            }
            
            if (role !== 'admin' && userId === req.session.user.id) {
                return res.status(403).json({
                    success: false,
                    message: "No puedes quitarte tus propios privilegios de administrador."
                });
            }
        }

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (nombre) {
            updates.push(`nombre = $${paramCount}`);
            values.push(nombre);
            paramCount++;
        }

        if (cedula) {
            const cedulaExists = await queryAsync(
                "SELECT id FROM usuarios WHERE cedula = $1 AND id != $2",
                [cedula, userId]
            );
            if (cedulaExists.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "La cédula ya está en uso por otro usuario."
                });
            }
            updates.push(`cedula = $${paramCount}`);
            values.push(cedula);
            paramCount++;
        }

        if (correo) {
            const correoExists = await queryAsync(
                "SELECT id FROM usuarios WHERE correo = $1 AND id != $2",
                [correo, userId]
            );
            if (correoExists.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "El correo electrónico ya está en uso por otro usuario."
                });
            }
            updates.push(`correo = $${paramCount}`);
            values.push(correo);
            paramCount++;
        }

        if (contrasena) {
            if (contrasena.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "La contraseña debe tener al menos 6 caracteres."
                });
            }
            const hashedPassword = await bcrypt.hash(contrasena, 10);
            updates.push(`contrasena = $${paramCount}`);
            values.push(hashedPassword);
            paramCount++;
        }

        if (role) {
            updates.push(`role = $${paramCount}`);
            values.push(role);
            paramCount++;
        }

        values.push(userId);

        const sql = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramCount}`;
        console.log(`💾 Ejecutando UPDATE perfil: ${sql}`, values);

        await queryAsync(sql, values);

        const updatedUser = await queryAsync(
            "SELECT id, cedula, nombre, correo, role, estado, fecha_registro FROM usuarios WHERE id = $1",
            [userId]
        );

        if (updatedUser.length > 0) {
            req.session.user = {
                ...req.session.user,
                ...updatedUser[0]
            };
        }

        return res.json({
            success: true,
            message: "Perfil actualizado correctamente",
            data: updatedUser[0]
        });

    } catch (error) {
        console.error("❌ Error al actualizar perfil:", error);
        return res.status(500).json({
            success: false,
            message: "Error al actualizar el perfil.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Eliminar cuenta de usuario
router.delete("/perfil", async (req, res) => {
    try {
        const userId = req.session.user.id;

        console.log(`🗑️ Eliminando cuenta del usuario ID: ${userId}`);

        const userExists = await queryAsync("SELECT id, role FROM usuarios WHERE id = $1", [userId]);
        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        if (userExists[0].role === 'admin') {
            const adminCount = await queryAsync(
                "SELECT COUNT(*) as count FROM usuarios WHERE role = 'admin' AND estado = 'activo'",
                []
            );
            
            if (parseInt(adminCount[0].count) <= 1) {
                return res.status(403).json({
                    success: false,
                    message: "No puedes eliminar la única cuenta de administrador activa del sistema."
                });
            }
        }

        // Soft delete: cambiar estado a suspendido
        await queryAsync(
            "UPDATE usuarios SET estado = 'suspendido', activo = false, fecha_suspension = CURRENT_TIMESTAMP WHERE id = $1",
            [userId]
        );

        req.session.destroy((err) => {
            if (err) {
                console.error("Error al destruir sesión:", err);
            }
        });

        return res.json({
            success: true,
            message: "Cuenta suspendida correctamente. Puede ser reactivada por un administrador."
        });

    } catch (error) {
        console.error("❌ Error al eliminar cuenta:", error);
        return res.status(500).json({
            success: false,
            message: "Error al eliminar la cuenta.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Obtener todos los usuarios (solo admin)
router.get("/usuarios", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await queryAsync(
            "SELECT id, cedula, nombre, correo, role, estado, fecha_registro, fecha_suspension, fecha_expiracion_suspension, fecha_bloqueo FROM usuarios ORDER BY id"
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

// Obtener lista simple de usuarios
router.get("/lista", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await queryAsync(
            "SELECT id, cedula, nombre, correo, role, estado, fecha_registro FROM usuarios ORDER BY nombre"
        );
        return res.json({ success: true, data: users });
    } catch (error) {
        console.error('❌ Error obteniendo lista simple de usuarios:', error.message);
        return res.status(500).json({ success: false, message: 'Error al obtener usuarios.' });
    }
});

// Obtener usuarios inactivos
router.get("/inactivos", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const rows = await queryAsync(
            "SELECT id, cedula, nombre, correo, role, estado, fecha_registro FROM usuarios WHERE estado != 'activo' ORDER BY nombre"
        );
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('❌ Error obteniendo usuarios inactivos:', error.message);
        return res.status(500).json({ success: false, message: 'Error al obtener usuarios inactivos.' });
    }
});

// Cambiar rol de usuario
router.put("/:id/role", authenticateToken, requireAdmin, async (req, res) => {
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

        const userExists = await queryAsync(
            "SELECT id, nombre, role FROM usuarios WHERE id = $1",
            [id]
        );
        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        const usuario = userExists[0];

        // Verificar si es el último administrador activo
        if (usuario.role === 'admin' && role === 'user') {
            const adminCount = await queryAsync(
                "SELECT COUNT(*) as count FROM usuarios WHERE role = 'admin' AND estado = 'activo' AND id != $1",
                [id]
            );
            
            if (parseInt(adminCount[0].count) < 1) {
                return res.status(403).json({
                    success: false,
                    message: "No se puede quitar el rol de administrador. Debe haber al menos un administrador activo."
                });
            }
        }

        await queryAsync("UPDATE usuarios SET role = $1 WHERE id = $2", [role, id]);

        console.log(`👑 Rol actualizado: Usuario ${usuario.nombre} (${id}) ahora es ${role}`);

        return res.json({
            success: true,
            message: `Rol de ${usuario.nombre} actualizado a ${role} correctamente.`
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

// Suspender usuario
router.put("/:id/suspender", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo, duracion_dias } = req.body;

        // No permitir suspenderse a sí mismo
        if (parseInt(id) === req.user.id) {
            return res.status(403).json({
                success: false,
                message: "No puedes suspender tu propia cuenta."
            });
        }

        const userExists = await queryAsync(
            "SELECT id, nombre, role, estado FROM usuarios WHERE id = $1",
            [id]
        );

        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        const usuario = userExists[0];

        if (usuario.estado === 'suspendido') {
            return res.status(400).json({
                success: false,
                message: "El usuario ya está suspendido."
            });
        }

        // Verificar si es el último administrador activo
        if (usuario.role === 'admin' && usuario.estado === 'activo') {
            const adminCount = await queryAsync(
                "SELECT COUNT(*) as count FROM usuarios WHERE role = 'admin' AND estado = 'activo' AND id != $1",
                [id]
            );
            
            if (parseInt(adminCount[0].count) < 1) {
                return res.status(403).json({
                    success: false,
                    message: "No puedes suspender la única cuenta de administrador activa."
                });
            }
        }

        // Calcular fecha de expiración
        let fecha_expiracion = null;
        if (duracion_dias && duracion_dias > 0) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() + parseInt(duracion_dias));
            fecha_expiracion = fecha.toISOString();
        }

        // Actualizar estado
        await queryAsync(
            `UPDATE usuarios 
             SET estado = 'suspendido', 
                 activo = false, 
                 fecha_suspension = CURRENT_TIMESTAMP, 
                 fecha_expiracion_suspension = $1 
             WHERE id = $2`,
            [fecha_expiracion, id]
        );

        console.log(`⏸️ Usuario ${usuario.nombre} suspendido por administrador ${req.user?.nombre}`);

        return res.json({
            success: true,
            message: `Usuario ${usuario.nombre} suspendido exitosamente.`,
            data: {
                id: usuario.id,
                nombre: usuario.nombre,
                estado: 'suspendido',
                fecha_expiracion: fecha_expiracion,
                duracion_dias: duracion_dias
            }
        });

    } catch (error) {
        console.error("❌ Error suspendiendo usuario:", error);
        return res.status(500).json({
            success: false,
            message: "Error al suspender usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Activar usuario
router.put("/:id/activar", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        const userExists = await queryAsync(
            "SELECT id, nombre, estado FROM usuarios WHERE id = $1",
            [id]
        );

        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        const usuario = userExists[0];

        if (usuario.estado === 'activo') {
            return res.status(400).json({
                success: false,
                message: "El usuario ya está activo."
            });
        }

        // Activar usuario
        await queryAsync(
            `UPDATE usuarios 
             SET estado = 'activo', 
                 activo = true, 
                 fecha_suspension = NULL, 
                 fecha_expiracion_suspension = NULL,
                 fecha_bloqueo = NULL 
             WHERE id = $1`,
            [id]
        );

        console.log(`✅ Usuario ${usuario.nombre} activado por administrador ${req.user?.nombre}`);

        return res.json({
            success: true,
            message: `Usuario ${usuario.nombre} activado exitosamente.`,
            data: {
                id: usuario.id,
                nombre: usuario.nombre,
                estado: 'activo'
            }
        });

    } catch (error) {
        console.error("❌ Error activando usuario:", error);
        return res.status(500).json({
            success: false,
            message: "Error al activar usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Bloquear usuario
router.put("/:id/bloquear", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        // No permitir bloquearse a sí mismo
        if (parseInt(id) === req.user.id) {
            return res.status(403).json({
                success: false,
                message: "No puedes bloquear tu propia cuenta."
            });
        }

        const userExists = await queryAsync(
            "SELECT id, nombre, role, estado FROM usuarios WHERE id = $1",
            [id]
        );

        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        const usuario = userExists[0];

        if (usuario.estado === 'bloqueado') {
            return res.status(400).json({
                success: false,
                message: "El usuario ya está bloqueado."
            });
        }

        // Verificar si es el último administrador activo
        if (usuario.role === 'admin' && usuario.estado === 'activo') {
            const adminCount = await queryAsync(
                "SELECT COUNT(*) as count FROM usuarios WHERE role = 'admin' AND estado = 'activo' AND id != $1",
                [id]
            );
            
            if (parseInt(adminCount[0].count) < 1) {
                return res.status(403).json({
                    success: false,
                    message: "No puedes bloquear la única cuenta de administrador activa."
                });
            }
        }

        // Bloquear usuario
        await queryAsync(
            `UPDATE usuarios 
             SET estado = 'bloqueado', 
                 activo = false, 
                 fecha_bloqueo = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [id]
        );

        console.log(`🚫 Usuario ${usuario.nombre} bloqueado por administrador ${req.user?.nombre}`);

        return res.json({
            success: true,
            message: `Usuario ${usuario.nombre} bloqueado permanentemente.`,
            data: {
                id: usuario.id,
                nombre: usuario.nombre,
                estado: 'bloqueado',
                fecha_bloqueo: new Date()
            }
        });

    } catch (error) {
        console.error("❌ Error bloqueando usuario:", error);
        return res.status(500).json({
            success: false,
            message: "Error al bloquear usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Obtener usuarios por estado
router.get("/usuarios/estado/:estado", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { estado } = req.params;
        
        if (!['activo', 'suspendido', 'bloqueado'].includes(estado)) {
            return res.status(400).json({
                success: false,
                message: "Estado inválido. Use: activo, suspendido o bloqueado."
            });
        }

        const users = await queryAsync(
            `SELECT id, cedula, nombre, correo, role, estado, fecha_registro, 
                    fecha_suspension, fecha_expiracion_suspension, fecha_bloqueo
             FROM usuarios 
             WHERE estado = $1 
             ORDER BY nombre`,
            [estado]
        );
        
        return res.json({
            success: true,
            data: users,
            count: users.length
        });
    } catch (error) {
        console.error("❌ Error obteniendo usuarios por estado:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener usuarios.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Eliminar usuario (soft delete)
router.delete("/usuarios/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // No permitir eliminarse a sí mismo
        if (parseInt(id) === req.user.id) {
            return res.status(403).json({
                success: false,
                message: "No puedes eliminar tu propia cuenta."
            });
        }

        const userExists = await queryAsync(
            "SELECT id, nombre, role, estado FROM usuarios WHERE id = $1",
            [id]
        );
        
        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado."
            });
        }

        const usuario = userExists[0];

        // Verificar si es el último administrador activo
        if (usuario.role === 'admin' && usuario.estado === 'activo') {
            const adminCount = await queryAsync(
                "SELECT COUNT(*) as count FROM usuarios WHERE role = 'admin' AND estado = 'activo' AND id != $1",
                [id]
            );
            
            if (parseInt(adminCount[0].count) < 1) {
                return res.status(403).json({
                    success: false,
                    message: "No puedes eliminar la única cuenta de administrador activa del sistema."
                });
            }
        }

        // Soft delete: suspender en lugar de eliminar
        await queryAsync(
            "UPDATE usuarios SET estado = 'suspendido', activo = false, fecha_suspension = CURRENT_TIMESTAMP WHERE id = $1",
            [id]
        );

        console.log(`🗑️ Usuario ${usuario.nombre} suspendido (soft delete) por administrador ${req.user?.nombre}`);

        return res.json({
            success: true,
            message: `Usuario ${usuario.nombre} suspendido correctamente.`,
            tipo: 'soft_delete',
            data: {
                id: usuario.id,
                nombre: usuario.nombre,
                estado: 'suspendido',
                accion: 'suspension_por_eliminacion'
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

module.exports = router;