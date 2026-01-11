-- Función corregida para sync_usuario_estado
-- El problema era que las condiciones se ejecutaban en el orden equivocado
-- y había lógica redundante que causaba conflictos

CREATE OR REPLACE FUNCTION sync_usuario_estado()
RETURNS TRIGGER AS $$
BEGIN
    -- Log para debugging
    RAISE NOTICE 'TRIGGER: OLD.estado=%, OLD.activo=%, NEW.estado=%, NEW.activo=%',
                 OLD.estado, OLD.activo, NEW.estado, NEW.activo;

    -- Solo procesar si alguno de los campos cambió
    IF (NEW.estado IS DISTINCT FROM OLD.estado) OR
       (NEW.activo IS DISTINCT FROM OLD.activo) THEN

        RAISE NOTICE 'TRIGGER: Campos cambiaron, procesando...';

        -- PRIMERO: Si cambió el estado, sincronizar activo
        IF NEW.estado IS DISTINCT FROM OLD.estado THEN
            CASE NEW.estado
                WHEN 'activo' THEN
                    NEW.activo = true;
                    RAISE NOTICE 'TRIGGER: Estado cambió a activo, NEW.activo = true';
                WHEN 'inactivo', 'suspendido', 'bloqueado', 'eliminado' THEN
                    NEW.activo = false;
                    RAISE NOTICE 'TRIGGER: Estado cambió a inactivo/bloqueado, NEW.activo = false';
                ELSE
                    -- Para otros estados, no cambiar activo
                    RAISE NOTICE 'TRIGGER: Estado cambió a %, manteniendo activo=%', NEW.estado, NEW.activo;
            END CASE;
        END IF;

        -- SEGUNDO: Si cambió activo (y no fue por el cambio de estado arriba), sincronizar estado
        IF NEW.activo IS DISTINCT FROM OLD.activo AND
           NOT (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            IF NEW.activo = true THEN
                NEW.estado = 'activo';
                RAISE NOTICE 'TRIGGER: Activo cambió a true, NEW.estado = activo';
            ELSE
                NEW.estado = 'inactivo';
                RAISE NOTICE 'TRIGGER: Activo cambió a false, NEW.estado = inactivo';
            END IF;
        END IF;
    END IF;

    RAISE NOTICE 'TRIGGER: FINAL - NEW.estado=%, NEW.activo=%', NEW.estado, NEW.activo;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;