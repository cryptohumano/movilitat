# Uso de Redis en el proyecto Movilitat

Redis está en Docker y en las variables de entorno pero **no se usa en el código**. Este documento analiza para qué nos serviría y qué priorizar.

---

## 1. Casos de uso que sí encajan

### 1.1 Rate limiting (límite de peticiones)

**Problema:** Cualquiera puede hacer muchas peticiones a `/api/auth/login` o a cualquier endpoint; no hay límite por IP ni por usuario. Eso facilita fuerza bruta o abuso.

**Con Redis:** Guardar por clave (por ejemplo `ratelimit:login:IP` o `ratelimit:login:telefono`) un contador con TTL (ej. 1 hora). En cada intento de login: incrementar; si supera N intentos (ej. 5), rechazar con 429. Lo mismo se puede aplicar a creación de check-ins o a la API en general por IP.

**Beneficio:** Seguridad y estabilidad sin tocar la lógica de negocio. Implementación típica: middleware que consulta/incrementa en Redis antes de seguir.

**Esfuerzo:** Bajo. Un middleware + cliente Redis (p. ej. `ioredis`).

---

### 1.2 Cache del dashboard

**Problema:** `GET /api/dashboard` hace muchas consultas a Postgres (conteos, agregaciones, listas) y se llama cada vez que el usuario entra o refresca. Con varios roles (Super Admin, Empresa, Checador, Chofer) las consultas son distintas pero repetitivas para el mismo usuario en pocos minutos.

**Con Redis:** Cachear la respuesta por `userId` (o `userId:role`) con TTL corto (ej. 30–60 segundos). Clave tipo `dashboard:userId`. Si existe y no expiró, devolverla; si no, calcular y guardar en Redis.

**Beneficio:** Menos carga en Postgres y respuestas más rápidas en picos de uso (varios checadores/choferes entrando a la vez).

**Esfuerzo:** Medio. Hay que definir TTL y cuándo invalidar (p. ej. tras un check-in reciente podría acortarse el TTL o no cachear si “últimos 2 min”).

---

### 1.3 Lista de tokens revocados (logout real)

**Problema:** Hoy la auth es JWT stateless: el backend no guarda sesiones. Si un usuario hace “logout”, el frontend borra el token pero el JWT sigue siendo válido hasta que expire. Si alguien copió el token, puede seguir usándolo.

**Con Redis:** Al hacer logout (nuevo endpoint `POST /api/auth/logout`), guardar el JWT (o su `jti` si lo usas) en Redis con TTL = tiempo restante de vida del token. Clave tipo `revoked:jti` o `revoked:tokenHash`. En el middleware de auth, después de verificar la firma del JWT, comprobar si está en Redis; si está, responder 401.

**Beneficio:** Logout que invalida el token de verdad y mejor control en caso de robo de dispositivo o “cerrar sesión en todos lados”.

**Esfuerzo:** Bajo–medio. Un endpoint logout, uso de Redis en el middleware de auth y que el front llame a logout al cerrar sesión.

---

### 1.4 Cache de consultas pesadas o catálogos

**Problema:** Algunas rutas hacen listados o agregaciones costosas: heatmap, listado de vehículos con filtros, paradas de referencia, etc. Si muchos usuarios piden lo mismo en poco tiempo, Postgres repite el mismo trabajo.

**Con Redis:** Cachear por “tipo de consulta + parámetros” con TTL (ej. 1–5 min). Ejemplos: `heatmap:inicio:fin`, `paradas:alcaldia:X`. Menos útil para datos muy específicos por usuario (ahí el dashboard cache por usuario es mejor).

**Beneficio:** Menor carga en DB en picos; respuestas más rápidas en reportes o mapas.

**Esfuerzo:** Medio. Hay que elegir qué rutas cachear y el TTL por tipo de dato.

---

## 2. Casos de uso menos prioritarios (o para más adelante)

- **Sesiones “stateful”:** Sustituir JWT por sesiones guardadas en Redis (session ID en cookie). Da logout y revocación fáciles pero implica más cambios (login, middleware, front). Solo tiene sentido si quieres abandonar JWT.
- **Colas (Bull/BullMQ):** Procesar tareas en segundo plano (emails, reportes, notificaciones). Útil cuando existan esos flujos; hasta entonces Redis no es imprescindible para colas.
- **Pub/Sub:** Útil si más adelante hay varios nodos del backend y necesitas notificaciones en tiempo real (ej. WebSockets repartidos). No es necesario con una sola instancia.

---

## 3. Recomendación de prioridad

| Orden | Uso            | Motivo principal                          |
|-------|----------------|-------------------------------------------|
| 1     | **Rate limiting** | Seguridad (login, API) con poco código.   |
| 2     | **Tokens revocados (logout)** | Mejorar auth sin cambiar a sesiones.      |
| 3     | **Cache dashboard** | Reducir carga y mejorar tiempos de respuesta. |
| 4     | **Cache otras rutas** | Cuando haya endpoints claramente pesados. |

---

## 4. Qué hace falta para usarlo

1. **Cliente en el backend:** por ejemplo `ioredis` (o `redis`).
2. **Conexión centralizada:** un módulo `lib/redis.ts` que lea `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` y exporte el cliente (o un singleton). Comprobar conexión al arrancar (o degradar sin Redis si no está disponible).
3. **Variables de entorno:** ya están en el compose y en `.env.example`; en producción (Railway, etc.) añadir las de Redis (Upstash u otro Redis gestionado) si se usa.

**Implementado:** Cliente Redis en `backend/src/lib/redis.ts`, middleware de rate limit en `backend/src/middleware/rateLimit.middleware.ts`, y aplicación en `POST /api/auth/login`. Ventana **dinámica por entorno:** en **producción** 5 intentos por IP cada 15 minutos; en **desarrollo** 5 intentos cada 15 segundos (clave distinta `login:dev` para no mezclar con prod). Si Redis no está disponible, el login sigue funcionando sin límite (degradación graceful).
