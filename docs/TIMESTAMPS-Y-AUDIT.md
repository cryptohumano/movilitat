# Timestamps y registro de actividad (audit)

## 1. Timestamps: cómo funcionan

### Almacenamiento
- **Base de datos (PostgreSQL):** Las columnas `DateTime` de Prisma se guardan en **UTC** (timestamp without time zone o con TZ según el driver; el valor interno es consistente).
- **Check-in:** `fechaHora` usa `@default(now())` — es la **hora del servidor en el momento del insert**. Si el servidor está en México, será hora México; si está en UTC, será UTC. Lo importante es que el **servidor** tenga una zona horaria fija (ej. `TZ=America/Mexico_City`).

### "Hoy" en el backend
- Cálculos como "check-ins hoy", "actividad hoy", "ingresos del mes" usan:
  - `const hoy = new Date(); hoy.setHours(0, 0, 0, 0);`
- Eso usa la **zona horaria del proceso Node** (variable de entorno `TZ` o la del sistema). Si el servidor está en México, "hoy" es medianoche México.

### Frontend
- Las fechas llegan en JSON como **ISO 8601** (UTC). El frontend usa `toLocaleString('es-MX', ...)` para mostrar en la zona horaria del **dispositivo del usuario**.

### Recomendación para que los registros de tiempo sean correctos
1. **Servidor:** Definir `TZ=America/Mexico_City` (o la zona que uses) en el entorno del backend para que "hoy" y `now()` sean coherentes.
2. **Verificación:** El endpoint `GET /api/health` devuelve `timestamp` en ISO. Se puede añadir en desarrollo (o para super admin) la hora del servidor y la `TZ` para comprobar.

---

## 2. Perfil PASAJERO

En el sistema, **PASAJERO** es el rol de **usuario de transporte público** que:
- **No** pertenece a ninguna empresa (no es chofer, checador ni admin de empresa).
- Puede **suscribirse a rutas (derroteros)** desde la pantalla **"Mis rutas"**: ve derroteros activos y elige a cuáles suscribirse.
- El dashboard para pasajero hoy solo devuelve `{ tipo: 'PASAJERO' }` (sin métricas propias).
- No registra check-ins; los check-ins son de **vehículos/choferes** en puntos de control (lo hace el **CHECADOR**).

Resumen: pasajero = usuario final que usa el transporte y sigue rutas (suscripciones), sin acceso a flotillas, check-ins ni administración.

---

## 3. Registro de actividad (audit log)

Para desarrollo y para que Super Admin y Admin de empresa vean lo concerniente a sus usuarios:
- Se guardan eventos en tabla **AuditLog**: login (éxito/fallo), creación de check-in, y opcionalmente cambios de usuario.
- **Super Admin:** ve todos los registros.
- **Admin Empresa:** ve solo registros de usuarios de su empresa (por `empresaId` del usuario que actuó).
- En desarrollo se puede ampliar lo que se registra (por ejemplo más acciones o requests).

Ver implementación: modelo `AuditLog`, `GET /api/audit-logs`, página "Registro de actividad" en el frontend.
