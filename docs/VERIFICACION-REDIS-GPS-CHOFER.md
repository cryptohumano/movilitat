# Verificación: Redis, tracking GPS y lógica chofer

Resumen de cómo está (o no) implementado Redis, el tracking GPS y la trazabilidad del chofer (kilómetros, unidad activa, etc.).

---

## 1. Redis en el proyecto

### Qué hace Redis en nuestro proyecto: **nada (no está implementado)**

- **Dónde aparece Redis:** solo en infraestructura y configuración.
  - `docker/docker-compose.yml`: servicio `redis` (imagen `redis:7-alpine`), puertos, contraseña, healthcheck.
  - `.env.example` y variables del backend en el compose: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
- **En el código del backend:** no hay ningún uso de Redis.
  - No existe cliente Redis (`ioredis`, `redis`, etc.) en `backend/package.json`.
  - No hay imports ni llamadas a Redis en `backend/src` (ni cache, ni sesiones, ni colas).

**Conclusión:** Redis **sí se usa** desde el backend: rate limiting en login (ver `docs/REDIS-USO-EN-PROYECTO.md`). Cliente en `lib/redis.ts`, middleware en `middleware/rateLimit.middleware.ts`. Si Redis no está disponible, el login sigue funcionando sin límite.

---

## 2. Tracking GPS: funciones y archivos

El “tracking” en el proyecto es **por evento**: se guarda la ubicación **en el momento del check-in**, no hay envío continuo de posición.

### Modelo de datos (Prisma)

- **CheckIn** (`backend/prisma/schema.prisma`): campos `latitud` y `longitud` (`Decimal?`) — ubicación del checador al registrar el paso del vehículo.
- **PuntoControl**: `latitud`, `longitud` — ubicación fija del punto.
- **ParadaReferencia**: `latitud`, `longitud` — paradas de referencia (ej. catálogo CDMX).

### Backend: dónde se manejan coordenadas

| Archivo | Qué hace |
|--------|-----------|
| `backend/src/routes/checkin.routes.ts` | **POST /api/checkins**: recibe `latitud`, `longitud` en el body y los guarda en el check-in (líneas ~118, 201). **POST /api/checkins/qr**: igual para check-in por QR (líneas ~266, 321). |
| `backend/src/routes/paradas-referencia.routes.ts` | Lista paradas con lat/long para mapas y puntos de control. |
| `backend/src/routes/analytics.routes.ts` | **GET /api/analytics/heatmap**: usa `latitud`/`longitud` de **PuntoControl** (no de CheckIn) para pintar puntos en el heatmap y contar check-ins por punto. |
| `backend/scripts/import-paradas-cdmx.ts` | Importa paradas con lat/long desde CSV. |

### Frontend: captura y envío de GPS

| Archivo | Qué hace |
|--------|-----------|
| `frontend/src/pages/CheckIn.tsx` | Usa `navigator.geolocation.getCurrentPosition` para obtener lat/lng (líneas ~79–86). Envía `latitud: location?.lat`, `longitud: location?.lng` en **POST /checkins** (líneas ~130–131) y en **POST /checkins/qr** (líneas ~161–162). |
| `frontend/src/pages/MapaActividad.tsx` | Muestra mapa con puntos (paradas de referencia y puntos de control con coordenadas). Usa datos de `/paradas-referencia` y del heatmap. |
| `frontend/src/pages/ParadasReferencia.tsx` | Lista/ mapa de paradas con lat/long. |

**Resumen GPS:** La única “trazabilidad GPS” implementada es la **ubicación en el momento del check-in** (checador): se captura en el navegador, se envía al API y se persiste en `CheckIn.latitud` / `CheckIn.longitud`. No hay tracking en tiempo real ni envío periódico de posición desde el chofer.

---

## 3. Lógica del chofer: unidad activa, kilometraje, trazabilidad

### 3.1 Unidad activa (qué unidad está manejando el chofer)

**Modelo:** `Chofer.vehiculoActivoId` (y relación `vehiculoActivo`). En `Vehiculo`: `choferActivo` (el chofer que tiene la unidad activa).

**Backend** (`backend/src/routes/chofer.routes.ts`):

| Ruta | Función | Implementado |
|------|---------|--------------|
| **GET /api/chofer/unidad-activa** | Devuelve si el chofer tiene unidad activa, cuál es y sus unidades asignadas. | Sí |
| **POST /api/chofer/activar-unidad** | Activa una unidad (solo si está en sus asignadas y nadie más la tiene activa). | Sí |
| **POST /api/chofer/terminar-unidad** | Libera la unidad activa (poner `vehiculoActivoId` en null). | Sí (función `handleTerminarUnidad`) |

**Frontend** (`frontend/src/pages/Dashboard.tsx`):

- Carga estado con `GET /chofer/unidad-activa` (chofer).
- Muestra si tiene unidad activa y cuál; permite activar (selector de unidades asignadas) y terminar unidad.
- Solo visible para rol `CHOFER`.

**Conclusión:** La lógica de **unidad activa** está implementada en backend y usada en el Dashboard del chofer.

### 3.2 Trazabilidad de kilómetros (y servicio/deterioro)

**Modelo:** `RegistroUnidad`: `tipo` (KM | SERVICIO | DETERIORO), `valorNumerico` (para KM), `descripcion` (para SERVICIO/DETERIORO), `vehiculoId`, `choferId` (quien registra).

**Backend** (`backend/src/routes/registros-unidad.routes.ts`):

| Ruta | Función | Implementado |
|------|---------|--------------|
| **GET /api/registros-unidad** | Lista registros por `vehiculoId`; incluye **resumen**: `ultimoKilometraje`, `fechaUltimoKm`. Filtros: tipo, fechas. | Sí |
| **POST /api/registros-unidad** | Crea registro (KM con `valorNumerico`; SERVICIO/DETERIORO con `descripcion`). Asigna `choferId` si el usuario es chofer. | Sí |

**Permisos:** El helper `puedeAccederVehiculo` restringe:
- **Chofer:** solo vehículos donde `vehiculo.choferId === chofer.id` (unidades asignadas al chofer).
- Admin empresa: vehículos de su empresa; Super Admin: todos.

**Frontend** (`frontend/src/pages/RegistrosRuta.tsx`):

- Para rol CHOFER carga sus vehículos desde `/dashboard` (chofer.vehiculos).
- Sección “Estadísticas de unidad”: tipo KM / SERVICIO / DETERIORO, input de kilometraje o descripción.
- Muestra último kilometraje y fecha; permite agregar registro y llama a **POST /registros-unidad**.
- Chofer solo puede elegir entre sus unidades asignadas (no solo la activa), lo cual es correcto para registrar km al cierre de turno.

**Conclusión:** La **trazabilidad de kilómetros** (y servicio/deterioro) está implementada: el chofer puede registrar KM (y otros tipos) sobre sus unidades asignadas; el backend devuelve el último kilometraje en el resumen.

### 3.3 Otras rutas que involucran al chofer

- **Dashboard chofer** (`dashboard.routes.ts`): `getDashboardChofer` — check-ins del día/mes, ingresos, vehículos asignados. Implementado.
- **Check-ins:** al crear check-in se asocia `choferId` (del vehículo o enviado en body). El chofer no crea check-ins; los crea el checador. Correcto.
- **Auth:** login devuelve `choferId`; registro público crea usuario CHOFER y perfil Chofer. Implementado.

---

## 4. Resumen

| Tema | Estado | Acción sugerida |
|------|--------|------------------|
| **Redis** | No implementado (solo en Docker y env). | Implementar uso (cache/sesiones) o quitar Redis del compose. |
| **Tracking GPS** | Solo “GPS en check-in”: captura en CheckIn.tsx, guardado en CheckIn en backend; heatmap usa coordenadas de PuntoControl. | Si se quiere tracking continuo del chofer, sería una funcionalidad nueva (envío periódico, otro modelo/endpoint). |
| **Unidad activa (chofer)** | Implementado: GET/POST unidad-activa, terminar-unidad; Dashboard chofer. | Ninguna; verificar flujo en UI si se desea. |
| **Kilometraje / trazabilidad unidad** | Implementado: RegistroUnidad (KM/SERVICIO/DETERIORO), GET/POST registros-unidad, resumen último km; front RegistrosRuta para chofer. | Ninguna; opcional: sugerir “unidad activa” por defecto al registrar km para el chofer. |

Si quieres, el siguiente paso puede ser: (1) añadir uso real de Redis (por ejemplo cache de dashboard o rate limit) o documentar su eliminación del compose, y (2) opcional: en el front, preseleccionar la unidad activa del chofer al abrir el formulario de registro de km.
