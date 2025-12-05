# 🚀 Guía de Configuración en Railway

## 📋 Pasos para Desplegar y Conectar a la Base de Datos

### 1️⃣ Crear la Base de Datos PostgreSQL en Railway

1. Entra a tu proyecto en [Railway.app](https://railway.app)
2. Haz clic en "+ New" y selecciona "Database"
3. Elige "PostgreSQL"
4. Espera a que se cree (toma ~1-2 minutos)
5. Haz clic en la instancia de PostgreSQL
6. Copia la variable `DATABASE_URL` completa

### 2️⃣ Configurar Variables de Entorno

En tu proyecto Railway:

1. Ve a la pestaña **"Variables"**
2. Agrega las siguientes variables:

```
DATABASE_URL=postgresql://postgres:PASSWORD@host:5432/railway
NODE_ENV=production
SESSION_SECRET=generaUnValorAleatorioSeguroAqui
JWT_SECRET=generaOtroValorAleatorioSeguroAqui
ADMIN_REGISTER_SECRET=generaUnTercerValorAleatorioSeguroAqui
FRONTEND_URL=https://tu-proyecto.up.railway.app
```

**Para generar valores aleatorios seguros, usa:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3️⃣ Conectar el Repositorio

1. En Railway, haz clic en "+ New"
2. Selecciona "GitHub Repo"
3. Conecta tu repositorio `softwareWMSMizooco`
4. Selecciona la rama `main`

### 4️⃣ Configurar el Deploy

Railway automáticamente detectará:
- `package.json` → Instalará dependencias
- `server.js` → Ejecutará como inicio

**El comando de inicio será:** `npm start`

### 5️⃣ Verificar Conexión a BD

Después del deploy:

1. Abre los **Logs** del proyecto
2. Deberías ver:
   ```
   ✅ Conectado a PostgreSQL exitosamente
   ✅ Conexión a PostgreSQL verificada exitosamente
   ```

Si ves errores de conexión:
- ❌ Verifica que `DATABASE_URL` esté correctamente copiada
- ❌ Asegúrate de que el Puerto no sea 5432 (Railway usa otro)
- ❌ Comprueba que la variable esté sin espacios

### 6️⃣ Crear Tablas en la BD

Si es la primera vez:

1. Conecta con un cliente PostgreSQL externo (pgAdmin, DBeaver)
2. Usa la `DATABASE_URL` que Railway proporciona
3. Ejecuta el archivo `schema.sql`:
   ```bash
   psql "tu_database_url" -f schema.sql
   ```

O ejecuta desde la aplicación (si tiene endpoint de inicialización).

### 7️⃣ Verificar el Deployment

Accede a: `https://tu-proyecto.up.railway.app`

Deberías ver:
- ✅ La página de login carga
- ✅ No hay errores de conexión a BD en la consola

---

## 🔧 Cambios Realizados en el Código

### `config/database.js`
- ✅ Ahora detecta automáticamente `DATABASE_URL` (formato Railway)
- ✅ Agrega SSL para conexiones seguras en producción
- ✅ Manejo de errores de pool mejorado
- ✅ Elimina contraseña hardcodeada

### `server.js`
- ✅ Valida conexión a BD antes de iniciar
- ✅ Mejor logging para depuración
- ✅ Soporta puertos dinámicos de Railway

---

## 🐛 Solución de Problemas

### Error: "connect ECONNREFUSED"
```
Solución: DATABASE_URL no está configurada o es incorrecta
→ Copia nuevamente desde Railway > Database > DATABASE_URL
```

### Error: "FATAL: password authentication failed"
```
Solución: Contraseña incorrecta en DATABASE_URL
→ Ve a PostgreSQL > Variables y copia exactamente
```

### Error: "relation does not exist"
```
Solución: Las tablas no existen en la BD
→ Ejecuta el schema.sql en la BD de Railway
```

### La aplicación se inicia pero sin conexión a BD
```
Verificar:
1. Que PostgreSQL esté corriendo en Railway
2. Que DATABASE_URL sea correcto
3. Ver logs: Railway > Logs
```

---

## 📝 Notas Importantes

- **Railway genera automáticamente** `DATABASE_URL` cuando creas PostgreSQL
- **No hardcodees** credenciales de BD, usa variables de entorno
- **En producción**, siempre usa `NODE_ENV=production`
- **El archivo `.env.local` NUNCA debe subirse** a Git (está en .gitignore)
- **Railway redeploya automáticamente** al hacer push a `main`

---

## 🔐 Checklist Final

- [ ] DATABASE_URL está configurada en Railway
- [ ] NODE_ENV está en "production"
- [ ] SESSION_SECRET y JWT_SECRET son valores únicos y seguros
- [ ] El repositorio está conectado y en rama "main"
- [ ] Las tablas existen en PostgreSQL
- [ ] El deploy dice "Deployed" en Railway
- [ ] Accedo a la URL y veo la aplicación sin errores

¡Listo! Tu aplicación debería estar conectada a PostgreSQL en Railway 🎉
