-- Modificar trigger para debugging
CREATE OR REPLACE FUNCTION public.sync_usuario_estado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE NOTICE 'TRIGGER: OLD.estado=%, OLD.activo=%, NEW.estado=%, NEW.activo=%',
                 OLD.estado, OLD.activo, NEW.estado, NEW.activo;

    -- Solo sincronizar si alguno de los dos campos cambia
    IF (NEW.estado IS DISTINCT FROM OLD.estado) OR
       (NEW.activo IS DISTINCT FROM OLD.activo) THEN

        RAISE NOTICE 'TRIGGER: Campos cambiaron, procesando...';

        -- Si estado cambia, actualizar activo
        IF NEW.estado IN ('inactivo', 'suspendido', 'bloqueado', 'eliminado') THEN
            NEW.activo = false;
            RAISE NOTICE 'TRIGGER: Estado inactivo/bloqueado, NEW.activo = false';
        ELSIF NEW.estado = 'activo' THEN
            NEW.activo = true;
            RAISE NOTICE 'TRIGGER: Estado activo, NEW.activo = true';
        END IF;

        -- Si activo cambia manualmente, actualizar estado
        IF NEW.activo = false AND OLD.activo = true THEN
            NEW.estado = 'inactivo';
            RAISE NOTICE 'TRIGGER: Activo cambió false->true, NEW.estado = inactivo';
        ELSIF NEW.activo = true AND OLD.activo = false THEN
            NEW.estado = 'activo';
            RAISE NOTICE 'TRIGGER: Activo cambió false->true, NEW.estado = activo';
        END IF;
    END IF;

    RAISE NOTICE 'TRIGGER: FINAL - NEW.estado=%, NEW.activo=%', NEW.estado, NEW.activo;
    RETURN NEW;
END;
$function$;