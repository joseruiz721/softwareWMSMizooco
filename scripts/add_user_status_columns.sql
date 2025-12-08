-- Script de migración: Agregar columnas de estado y bloqueo a tabla usuarios
-- Ejecutar este script para actualizar el esquema existente

-- 1. Agregar columna 'estado' si no existe (con valor por defecto 'activo')
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo';

-- 2. Agregar columna 'activo' si no existe (equivalente al estado)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- 3. Agregar columna 'fecha_bloqueo' para registrar cuándo se bloqueó un usuario
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS fecha_bloqueo TIMESTAMP;

-- 4. Agregar columna 'fecha_suspension' para registrar cuándo se suspendió un usuario
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS fecha_suspension TIMESTAMP;

-- 5. Agregar columna 'fecha_expiracion_suspension' para suspensiones temporales
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS fecha_expiracion_suspension TIMESTAMP;

-- 6. Agregar columna 'motivo_suspension' para guardar el motivo
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS motivo_suspension TEXT;

-- 7. Agregar columna 'motivo_bloqueo' para guardar el motivo del bloqueo
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS motivo_bloqueo TEXT;

-- 8. Sincronizar: donde activo=false, marcar como suspendido/bloqueado
-- (Nota: Esto solo se ejecuta si activo existe y tiene valores false)
-- Aquí puedes ajustar la lógica según tus necesidades

COMMIT;
