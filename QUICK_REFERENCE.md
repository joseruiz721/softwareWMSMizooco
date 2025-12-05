# ⚡ REFERENCIA RÁPIDA - Railway Setup (2 Minutos)

## 🎯 OBJETIVO
Conectar tu aplicación Node.js a PostgreSQL en Railway

---

## 🔥 COMANDO RÁPIDO (Si sabes qué estás haciendo)

```bash
# 1. Copiar DATABASE_URL de Railway PostgreSQL
# 2. Configurar variable en Railway > Variables
# 3. Ejecutar schema
psql "tu_database_url" -f schema.sql
# 4. Esperar deploy (automático)
# 5. Done ✅
```

---

## 📋 CHECKLIST MÍNIMO

- [ ] PostgreSQL creada en Railway
- [ ] DATABASE_URL copiada exactamente
- [ ] Variables: NODE_ENV=production
- [ ] Variables: SESSION_SECRET=valor_aleatorio
- [ ] Variables: JWT_SECRET=valor_aleatorio
- [ ] Variables: ADMIN_REGISTER_SECRET=valor_aleatorio
- [ ] schema.sql ejecutado
- [ ] Deploy completado
- [ ] Log dice: ✅ Conectado a PostgreSQL

---

## 🚨 SI FALLA

### Error: "connect ECONNREFUSED"
```
→ DATABASE_URL no está o es incorrecta
→ Solución: Copiar exactamente desde PostgreSQL > Variables
```

### Error: "password authentication failed"
```
→ DATABASE_URL con contraseña mal
→ Solución: No editar, copiar original de Railway
```

### Error: "relation does not exist"
```
→ Tablas no creadas
→ Solución: psql "DATABASE_URL" -f schema.sql
```

---

## 📁 DOCUMENTOS DISPONIBLES

- **INSTRUCCIONES_FINALES.md** ← Empieza aquí
- **RAILWAY_SETUP.md** ← Paso a paso detallado
- **RAILWAY_CHECKLIST.md** ← Troubleshooting completo
- **CAMBIOS_RAILWAY.md** ← Detalles técnicos
- **.env.example** ← Variables requeridas

---

## ⏱️ TIEMPO TOTAL

```
1. Crear BD          → 2 min
2. Copiar DATABASE   → 1 min
3. Variables         → 2 min
4. Deploy            → 3 min
5. Schema           → 1 min
────────────────────────
TOTAL               → 9 min ✅
```

---

## 🔗 VARIABLES EN RAILWAY

```javascript
DATABASE_URL           // De PostgreSQL automáticamente
NODE_ENV               // "production"
SESSION_SECRET         // Aleatorio seguro
JWT_SECRET             // Aleatorio seguro
ADMIN_REGISTER_SECRET  // Aleatorio seguro
FRONTEND_URL           // Tu URL de Railway
```

---

## 💾 CÓDIGO CAMBIADO

### config/database.js
```javascript
// ✅ NUEVO - Detecta DATABASE_URL
const pool = new Pool(
    process.env.DATABASE_URL 
        ? { connectionString: process.env.DATABASE_URL, ssl: {...} }
        : { user, host, password: process.env.DB_PASSWORD, ... }
);
```

### server.js
```javascript
// ✅ NUEVO - Valida BD antes de iniciar
async function validateDatabaseConnection() {
    try {
        await databaseConfig.queryAsync('SELECT NOW()');
        return true;
    } catch (err) {
        console.error('❌ No conecta a BD');
        return false;
    }
}
```

---

## ✅ VERIFICACIÓN POST-DEPLOY

### En Railway > Logs, busca:
```
✅ Conectado a PostgreSQL exitosamente
✅ Conexión a PostgreSQL verificada exitosamente
🚀 Servidor ejecutándose en: https://...
```

### En tu navegador:
```
GET https://tu-app.up.railway.app
→ Debes ver: Página de login sin errores
```

---

## 🎯 NEXT STEPS

1. Abre: **INSTRUCCIONES_FINALES.md**
2. Sigue: **RAILWAY_SETUP.md** paso a paso
3. Verifica: **RAILWAY_CHECKLIST.md**

---

**Estado:** ✅ Listo para Railway  
**Documentación:** Completa  
**Tiempo estimado:** 10 minutos  
**Dificultad:** ⭐ Fácil (solo copy-paste)

🚀 **¡Adelante!**
