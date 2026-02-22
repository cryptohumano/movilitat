# Estado actual del proyecto – Movilitat

Resumen de lo que está implementado y lo que falta (además de añadir MinIO y el servicio MinIO en Docker).

---

## 1. Lo que ya está

### Infra y entorno
- **Monorepo** (yarn workspaces): `backend`, `frontend`.
- **Docker Compose** (`docker/docker-compose.yml`): Postgres 16, Redis 7, backend (Node), frontend (Nginx sirviendo build de Vite). Red y volúmenes para Postgres y Redis.
- **Variables de entorno**: `.env.example` con Postgres, JWT, backend, frontend (`VITE_API_URL`), Redis, `DOMAIN`. No hay variables MinIO aún.
- **Backend** escucha en `process.env.PORT || process.env.BACKEND_PORT || 3001` (listo para Railway/Render).

### Base de datos
- **Prisma** con PostgreSQL: schema con usuarios, empresas, derroteros, vehículos, check-ins, suscripciones, audit, etc.
- **User.avatar** existe como `String?` (URL o path); no hay flujo de subida ni integración con storage.
- Migraciones en `backend/prisma/migrations`.

### Backend (Express)
- Rutas: auth (login, register, me, password), empresas, derroteros, vehículos, checkins, users, dashboard, registros-ruta, registros-unidad, chofer (unidad-activa, activar/terminar), suscripciones-ruta, analytics, paradas-referencia, flotillas, audit-logs.
- Middleware de auth y autorización por roles.
- CORS: en producción usa `https://${process.env.DOMAIN}` (un solo origen).
- **Redis**: está en el compose y en `.env`, pero **no hay ningún uso de Redis en el código** (no hay cliente ni cache/sesiones).

### Frontend (Vite + React)
- PWA, cliente API en `src/lib/api.ts` usando `VITE_API_URL`.
- Páginas: Login, Dashboard, CheckIn, RegistrosRuta, MisRutas, Usuarios, Vehiculos, etc.

### Documentación
- `docs/DEPLOY-ROADMAP.md`: VPS vs cloud, Supabase, MinIO, alternativas a Redis, Vite en Vercel.
- `docs/DEPLOY-CLOUD-PASO-A-PASO.md`: paso a paso backend + Supabase + MinIO/Storage + frontend en Vercel y conexión front–backend.
- `docs/MINIO-SETUP.md`: cómo añadir MinIO al compose, variables y ejemplo de capa storage en backend.
- `docs/TIMESTAMPS-Y-AUDIT.md`, `docs/ESTADO-UNIDADES-Y-FLOTILLAS.md`.

---

## 2. Qué falta (además de “añadir MinIO” y “MinIO en Docker”)

### 2.1 MinIO y storage (resumen)
- Añadir **servicio MinIO** al `docker-compose.yml` (ver `docs/MINIO-SETUP.md`).
- Añadir variables **MinIO** a `.env.example` y al bloque `environment` del backend en el compose (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`).
- En el backend: **capa de storage** (`backend/src/lib/storage.ts`) con cliente S3 contra MinIO (upload, URL firmada, delete) y **uso real** (p. ej. ruta `PUT /api/auth/avatar` o similar que suba a MinIO y guarde la key/URL en `User.avatar`). Dependencia: `@aws-sdk/client-s3` (y opcionalmente `@aws-sdk/s3-request-presigner`).

### 2.2 Redis
- **Situación:** Redis está en el compose y en `.env`, pero el backend no lo usa (no hay `redis` ni `ioredis` en el código).
- **Opciones:** (a) Dar uso a Redis (cache, rate limit, sesiones) e instalar cliente en el backend; o (b) Quitar Redis del compose y de la doc si no se va a usar a corto plazo, para no tener un servicio innecesario.

### 2.3 Docker
- **Migraciones:** Al hacer `docker compose up`, el backend arranca con `node dist/index.js` y **no ejecuta migraciones**. Hay que ejecutar a mano `prisma migrate deploy` dentro del contenedor (o desde el host con `DATABASE_URL` apuntando al postgres del compose), o cambiar el **CMD** del backend a algo como `prisma migrate deploy && node dist/index.js` (y que el Dockerfile tenga `prisma` disponible en la imagen final).
- **Healthchecks:** Solo Postgres y Redis tienen `healthcheck`. Añadir healthcheck al **backend** (p. ej. `GET /api/health`) y opcionalmente al frontend, para que el compose pueda esperar a que el API esté listo.

### 2.4 CORS
- En producción solo se permite un origen: `https://${process.env.DOMAIN}`. Si usas a la vez `movilitat.vercel.app` y un dominio propio (ej. `app.movilitat.mx`), hay que permitir ambos (p. ej. lista de orígenes en env o varias variables).

### 2.5 Otros (opcionales)
- **Creación del bucket MinIO** al levantar por primera vez: script de init o instrucción en la doc para crearlo en la consola MinIO (puerto 9001).
- **Tests** (backend/frontend): no se ha comprobado si hay suite; si no hay, añadir al menos tests básicos de API o críticos.
- **CI/CD**: si se usa GitHub Actions u otro, asegurar que el build (backend + frontend) y las migraciones (o `prisma migrate deploy` en deploy) estén cubiertos.

---

## 3. Checklist rápido de pendientes

| Pendiente | Dónde / Cómo |
|-----------|----------------|
| Servicio MinIO en Docker | Añadir en `docker/docker-compose.yml` (ver MINIO-SETUP.md). |
| Variables MinIO en env | `.env.example` y `environment` del backend en compose. |
| Capa storage + uso (ej. avatar) | `backend/src/lib/storage.ts` + ruta de upload y guardar en `User.avatar`. |
| Decidir Redis | Usar (añadir cliente y lógica) o quitar del compose. |
| Migraciones al levantar Docker | CMD del backend tipo `prisma migrate deploy && node dist/index.js` o script de entrypoint. |
| Healthcheck del backend | En compose, `healthcheck` con `GET /api/health`. |
| CORS varios orígenes (si aplica) | Lista de dominios en backend (env o config). |

Si quieres, el siguiente paso puede ser: (1) añadir MinIO al `docker-compose` y a `.env.example`, y (2) esbozar `backend/src/lib/storage.ts` y una ruta `PUT /api/auth/avatar` que suba a MinIO y actualice `User.avatar`.
