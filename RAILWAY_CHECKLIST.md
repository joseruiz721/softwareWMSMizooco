# ✅ Checklist de Verificación - Railway Setup

## 📋 Verificar Antes de Desplegar

### Base de Datos
- [ ] PostgreSQL creada en Railway
- [ ] DATABASE_URL copiada correctamente
- [ ] Probada conexión con un cliente (pgAdmin, DBeaver)
- [ ] Schema.sql ejecutado en la BD de Railway

### Variables de Entorno en Railway
- [ ] `DATABASE_URL` configurada
- [ ] `NODE_ENV=production` configurada
- [ ] `SESSION_SECRET` configurada (valor único)
- [ ] `JWT_SECRET` configurada (valor único)
- [ ] `ADMIN_REGISTER_SECRET` configurada (valor único)
- [ ] `FRONTEND_URL` configurada (URL de Railway)

### Código Actualizado ✅
- [x] `config/database.js` actualizado ✅
- [x] `server.js` con validación de BD ✅
- [x] `.env.example` creado ✅
- [x] `RAILWAY_SETUP.md` creado ✅

### Seguridad
- [ ] No hay `.env` en git
- [ ] No hay contraseñas en el código
- [ ] SESSION_SECRET es valor aleatorio seguro
- [ ] JWT_SECRET es valor aleatorio seguro

---

## 🚀 Pasos para Deploy

### 1. Preparar Repositorio Local
```bash
git add .
git commit -m "Actualizaciones para Railway: BD y variables de entorno"
git push origin main
```

### 2. Crear Proyecto en Railway
```
1. Railway.app > New Project
2. Conectar repositorio GitHub (softwareWMSMizooco)
3. Seleccionar rama: main
```

### 3. Agregar PostgreSQL
```
1. Railway > + New > Database > PostgreSQL
2. Esperar a que se cree (1-2 minutos)
3. Copiar DATABASE_URL
```

### 4. Configurar Variables de Entorno
En Railway Dashboard:
```
1. Proyecto > Variables
2. Agregar todas las variables (ver tabla abajo)
3. Database > Variables (DATABASE_URL aparece aquí)
```

| Variable | Valor | Cómo Generarlo |
|----------|-------|----------------|
| `DATABASE_URL` | De PostgreSQL | Railway genera automáticamente |
| `NODE_ENV` | `production` | Escribe esto |
| `SESSION_SECRET` | Valor aleatorio | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_SECRET` | Valor aleatorio | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_REGISTER_SECRET` | Valor aleatorio | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FRONTEND_URL` | `https://tu-app.up.railway.app` | Se verá después del deploy |

### 5. Deploy
```
1. Railway > Deploy (automático al push a main)
2. Esperar a que el deploy termine
3. Ver logs para verificar conexión a BD
```

### 6. Ejecutar Schema
```bash
# Desde tu máquina local
psql "postgresql://user:password@host:5432/railway" -f schema.sql

# O usar DBeaver/pgAdmin para ejecutar el schema.sql
```

### 7. Verificar
```
1. Acceder a: https://tu-app.up.railway.app
2. Ver logs en Railway > Logs
3. Buscar: "✅ Conexión a PostgreSQL verificada exitosamente"
4. Intentar login
```

---

## 🔍 Verificar en Logs

Después del deploy, deberías ver en Railway > Logs:

```
✅ Conectado a PostgreSQL exitosamente
✅ Conexión a PostgreSQL verificada exitosamente
🔐 Sistema de roles y autenticación activado
📸 Sistema de asistencias MULTI-USUARIO activado
🚀 Servidor ejecutándose en: https://tu-app.up.railway.app
```

---

## ❌ Solución de Problemas Comunes

### 1. Error: "connect ECONNREFUSED"
```
❌ Problema: DATABASE_URL no existe o es incorrecta
✅ Solución:
   - Railway > PostgreSQL > Variables
   - Copiar DATABASE_URL exactamente
   - Recrear la variable en el proyecto
   - Redeploy
```

### 2. Error: "password authentication failed"
```
❌ Problema: Contraseña en DATABASE_URL es incorrecta
✅ Solución:
   - La DATABASE_URL debe ser del PostgreSQL que creaste
   - No uses otra contraseña
   - Copia exactamente desde Railway
```

### 3. Error: "relation does not exist"
```
❌ Problema: Las tablas no fueron creadas
✅ Solución:
   - Conectar a PostgreSQL con pgAdmin o DBeaver
   - Ejecutar el contenido de schema.sql
   - Las tablas deberían aparecer
```

### 4. App inicia pero sin BD
```
❌ Problema: La BD está lenta o hay timeout
✅ Solución:
   - Aumentar timeout en Railway
   - Verificar que PostgreSQL está corriendo
   - Revisar logs de PostgreSQL en Railway
```

### 5. Error: "SESSION_SECRET not defined"
```
❌ Problema: Variable de entorno no configurada
✅ Solución:
   - Railway > Variables
   - Agregar SESSION_SECRET con un valor único
   - Redeploy
```

---

## 📊 Diagrama de Flujo

```
Local (git push main)
    ↓
GitHub Repository
    ↓
Railway (detecta push)
    ↓
Build (instala dependencias)
    ↓
Deploy (ejecuta npm start)
    ↓
Conecta a PostgreSQL (DATABASE_URL)
    ↓
Valida esquema y usuario admin
    ↓
Aplicación en línea ✅
```

---

## 🎯 Resumen de Cambios en el Código

### Antes ❌
```javascript
// config/database.js
password: process.env.DB_PASSWORD || '09262405'  // ❌ Hardcodeado
// Sin SSL
// Sin manejo de DATABASE_URL
// Sin validación de errores
```

### Después ✅
```javascript
// config/database.js
const pool = new Pool(
    process.env.DATABASE_URL  // ✅ Railway format
        ? { connectionString: process.env.DATABASE_URL, ssl: { ... } }
        : { user, host, password: process.env.DB_PASSWORD, ... }
);
pool.on('error', ...);  // ✅ Manejo de errores
pool.on('connect', ...);  // ✅ Logging
```

### En server.js ✅
```javascript
async function validateDatabaseConnection() {
    try {
        const result = await databaseConfig.queryAsync('SELECT NOW()');
        console.log('✅ Conexión a PostgreSQL verificada');
        return true;
    } catch (err) {
        console.error('❌ ERROR de BD:', err.message);
        return false;
    }
}
```

---

## ✨ Beneficios Después del Setup

✅ **Accesible 24/7** - Desplegado en Railway  
✅ **Base de datos en la nube** - PostgreSQL en Railway  
✅ **URL pública** - https://tu-app.up.railway.app  
✅ **Auto-deploy** - Actualiza con cada push a main  
✅ **Seguro** - Variables de entorno encriptadas  
✅ **Monitoreado** - Logs disponibles en Railway  

---

## 📞 Ayuda Rápida

```
Problema              | Solución
---------------------|------------------------------------------
No conecta a BD       | Verificar DATABASE_URL en variables
Página no carga       | Ver logs, buscar errores
Sesiones no funcionan | SESSION_SECRET configurada?
Login falla           | Verificar schema.sql ejecutado
```

---

**Documento actualizado:** 5 de diciembre de 2024  
**Estado:** Listo para Railway ✅
