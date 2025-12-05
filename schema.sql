-- Esquema de Base de Datos Convertido para PostgreSQL
-- schema.sql - Esquema completo para Sistema WMS Mizooco
-- Ejecutar este script en Railway PostgreSQL para crear todas las tablas

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP
);

-- Tabla para sesiones (requerida por connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- Tabla de ordenadores (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS ordenadores (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(15),
    ubicacion VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT true,
    serial VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_ingreso DATE NOT NULL,
    observaciones TEXT,
    id_usuario_responsable INTEGER REFERENCES usuarios(id),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    marca VARCHAR(50),
    trial186 VARCHAR(50),
    activo_fijo VARCHAR(50)
);

-- Tabla de access point (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS access_point (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(15),
    ubicacion VARCHAR(100) NOT NULL,
    serial VARCHAR(50),
    modelo VARCHAR(50),
    version VARCHAR(20),
    arquitectura VARCHAR(20),
    mac VARCHAR(20),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_ingreso DATE NOT NULL,
    observacion TEXT,
    id_usuarios_responsable INTEGER REFERENCES usuarios(id),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial186 VARCHAR(50),
    activo_fijo VARCHAR(50)
);

-- Tabla de readers (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS readers (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(15),
    ubicacion VARCHAR(100) NOT NULL,
    no_maquina VARCHAR(50),
    serial VARCHAR(50),
    mac VARCHAR(17),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_ingreso DATE NOT NULL,
    observaciones TEXT,
    id_usuario_responsable INTEGER REFERENCES usuarios(id),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial186 VARCHAR(50),
    activo_fijo VARCHAR(50)
);

-- Tabla de etiquetadoras (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS etiquetadoras (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(15),
    ubicacion VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT true,
    serial VARCHAR(50),
    modelo VARCHAR(50),
    serial_aplicador VARCHAR(50),
    mac VARCHAR(17),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_ingreso DATE NOT NULL,
    observaciones TEXT,
    id_usuarios_responsable INTEGER REFERENCES usuarios(id),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial186 VARCHAR(50),
    activo_fijo VARCHAR(50)
);

-- Tabla de tablets (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS tablets (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(15),
    ubicacion VARCHAR(100) NOT NULL,
    no_maquina VARCHAR(50),
    activo BOOLEAN DEFAULT true,
    serial VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_ingreso DATE NOT NULL,
    observaciones TEXT,
    id_usuario_responsable INTEGER REFERENCES usuarios(id),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial186 VARCHAR(50),
    activo_fijo VARCHAR(50)
);

-- Tabla de lectores QR (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS lectores_qr (
    id SERIAL PRIMARY KEY,
    ubicacion VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT true,
    modelo VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_ingreso DATE NOT NULL,
    observaciones TEXT,
    id_usuarios_responsable INTEGER REFERENCES usuarios(id),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial186 VARCHAR(50),
    activo_fijo VARCHAR(50)
);

-- Tabla de repuestos (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS repuestos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    proceso VARCHAR(50),
    descripcion TEXT,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    codigo_siesa VARCHAR(50),
    cantidad INTEGER DEFAULT 0,
    rotacion VARCHAR(20) DEFAULT 'Media',
    stock_minimo INTEGER DEFAULT 5,
    fecha_ingreso DATE NOT NULL,
    ubicacion VARCHAR(100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial186 VARCHAR(50)
);

-- Tabla de mantenimientos (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS mantenimientos (
    id SERIAL PRIMARY KEY,
    id_usuarios INTEGER REFERENCES usuarios(id),
    tipo VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    id_dispositivo INTEGER,
    id_repuesto INTEGER,
    descripcion TEXT,
    observaciones TEXT,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial186 VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'Pendiente',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dispositivo_tipo VARCHAR(20)
);

-- NUEVAS TABLAS QUE NO ESTABAN EN TU SCHEMA ORIGINAL

-- Tabla de password reset tokens (NUEVA)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de horarios calendario (NUEVA)
CREATE TABLE IF NOT EXISTS horarios_calendario (
    id SERIAL PRIMARY KEY,
    mes INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    datos_calendario JSONB NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_usuario_creo INTEGER REFERENCES usuarios(id),
    orden_tecnicos JSONB DEFAULT '[]'::jsonb
);

-- Tabla de técnicos horarios (NUEVA)
CREATE TABLE IF NOT EXISTS tecnicos_horarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de asistencias (ACTUALIZADA con nuevas columnas)
CREATE TABLE IF NOT EXISTS asistencias (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    foto_path VARCHAR(500),
    ip_origen VARCHAR(50),
    user_agent VARCHAR(500),
    registrante_id INTEGER REFERENCES usuarios(id),
    registrante_nombre VARCHAR(255),
    registrante_role VARCHAR(50)
);

-- Insertar usuario administrador por defecto
-- Contraseña: 'password' (hasheada con bcrypt)
INSERT INTO usuarios (cedula, nombre, correo, contrasena, role) 
VALUES (
    '12345678', 
    'Administrador Principal', 
    'joseraulruizreal@gmail.com', 
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
    'admin'
) ON CONFLICT (correo) DO NOTHING;

-- Insertar algunos repuestos de ejemplo
INSERT INTO repuestos (nombre, codigo, cantidad, stock_minimo, ubicacion, fecha_ingreso) VALUES
('Memoria RAM 8GB DDR4', 'RAM-8GB-DDR4', 25, 5, 'Almacén A', CURRENT_DATE),
('Disco SSD 500GB', 'SSD-500GB', 15, 3, 'Almacén B', CURRENT_DATE),
('Teclado USB', 'TEC-USB', 30, 10, 'Almacén C', CURRENT_DATE),
('Mouse Óptico', 'MS-OPT', 40, 15, 'Almacén A', CURRENT_DATE)
ON CONFLICT (codigo) DO NOTHING;

-- Insertar algunos técnicos de ejemplo
INSERT INTO tecnicos_horarios (nombre, color) VALUES
('Juan Pérez', '#FF5733'),
('María García', '#33FF57'),
('Carlos López', '#3357FF'),
('Ana Martínez', '#F333FF')
ON CONFLICT DO NOTHING;

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_cedula ON usuarios(cedula);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
CREATE INDEX IF NOT EXISTS idx_repuestos_codigo ON repuestos(codigo);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_fecha ON mantenimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_usuario_fecha ON asistencias(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_horarios_calendario_mes_anio ON horarios_calendario(mes, anio);

-- Mensaje de confirmación
DO $$ 
BEGIN
    RAISE NOTICE '✅ Esquema de base de datos creado exitosamente';
    RAISE NOTICE '📊 Tablas creadas: usuarios, session, ordenadores, access_point, readers, etiquetadoras, tablets, lectores_qr, repuestos, mantenimientos, asistencias';
    RAISE NOTICE '📊 Tablas nuevas: password_reset_tokens, horarios_calendario, tecnicos_horarios';
    RAISE NOTICE '👤 Usuario administrador: joseraulruizreal@gmail.com / password';
    RAISE NOTICE '🔄 Columnas actualizadas en todas las tablas existentes';
END $$;