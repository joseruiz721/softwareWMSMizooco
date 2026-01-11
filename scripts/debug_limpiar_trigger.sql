-- Trigger de debug para limpiar_usuarios_eliminados
CREATE OR REPLACE FUNCTION debug_limpiar_usuarios_eliminados()
RETURNS TRIGGER AS $$
BEGIN
  -- Log detallado del trigger
  RAISE NOTICE '🔍 TRIGGER limpiar_usuarios_eliminados ACTIVADO';
  RAISE NOTICE '   OLD.correo: %', OLD.correo;
  RAISE NOTICE '   OLD.estado: %', OLD.estado;
  RAISE NOTICE '   NEW.estado: %', NEW.estado;
  RAISE NOTICE '   Patrón _eliminado_: %', OLD.correo LIKE '%_eliminado_%';

  -- Elimina físicamente si detecta el patrón _eliminado_ en el correo
  IF OLD.correo LIKE '%_eliminado_%' THEN
    RAISE NOTICE '⚠️  ELIMINANDO USUARIO POR PATRÓN _eliminado_';
    DELETE FROM usuarios WHERE id = OLD.id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '✅ TRIGGER limpiar_usuarios_eliminados: PASANDO SIN MODIFICAR';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reemplazar el trigger original con el de debug
DROP TRIGGER IF EXISTS trigger_limpiar_eliminados ON usuarios;
CREATE TRIGGER trigger_limpiar_eliminados
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION debug_limpiar_usuarios_eliminados();