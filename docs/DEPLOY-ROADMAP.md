# Roadmap de deploy – Movilitat

Este documento describe dos caminos para llevar Movilitat a producción (o entorno de testing): **VPS + stack opensource** (incl. MinIO) y **cloud / cloud computing** (Supabase, servicios gestionados, etc.). Incluye integración de **buckets MinIO** y un roadmap paso a paso para quien nunca ha hecho deploy en cloud.

---

## 1. Resumen: dos enfoques

| Enfoque | Ideal para | Esfuerzo inicial | Coste típico |
|--------|------------|------------------|--------------|
| **A. VPS + opensource** | Control total, datos on‑prem, MinIO en tu infra | Medio (Docker, Nginx, SSL) | VPS ~5–20 €/mes + dominio |
| **B. Cloud / PaaS** | Testing rápido, menos ops, escalar sin tocar servidores | Bajo (cuentas, env vars, deploy) | Free tier luego ~10–50 €/mes |

**Recomendación si nunca has hecho deploy en cloud:** empezar por **B (Supabase + un PaaS)** para tener algo en producción en poco tiempo; luego, si quieres bajar coste o tener todo bajo tu control, seguir el **roadmap A** en un VPS.

---

## 2. Opción A: VPS + stack opensource (Postgres, Redis, MinIO)

### 2.1 Stack objetivo

- **VPS:** cualquier proveedor (Hetzner, DigitalOcean, Linode, OVH, etc.).
- **PostgreSQL:** en Docker (como ya tienes) o instalado en el host.
- **Cache/sesión:** **Redis** o alternativas open source compatibles (ver [Alternativas a Redis](#alternativas-a-redis-open-source) más abajo).
- **MinIO:** objeto storage S3‑compatible (archivos, reportes, avatares, etc.).
- **Backend (Node) y frontend (Vite PWA):** en Docker.
- **Nginx:** reverse proxy, SSL (Let’s Encrypt), estáticos si aplica.
- **Opcional:** cron para backups de Postgres y datos MinIO.

### 2.2 Integración de MinIO en el proyecto

**Qué falta hoy:** el `.env.example` y el `docker-compose` no incluyen MinIO. Pasos sugeridos:

1. **Añadir servicio MinIO al `docker/docker-compose.yml`:**
   - Servicio `minio` con imagen `minio/minio`, puerto 9000 (API) y 9001 (consola).
   - Variables: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`.
   - Volumen persistente para datos.

2. **Variables de entorno (`.env.example` y producción):**
   - `MINIO_ENDPOINT` (ej. `http://minio:9000` en Docker, `https://minio.tudominio.com` en producción).
   - `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` (o `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` según cómo lo expongas al backend).
   - `MINIO_BUCKET` (nombre del bucket por defecto, ej. `movilitat-uploads`).
   - Opcional: `MINIO_USE_SSL`, `MINIO_REGION`.

3. **En el backend:**
   - Cliente S3‑compatible (ej. `@aws-sdk/client-s3`) configurado con endpoint = MinIO y las credenciales anteriores.
   - Rutas/helpers para: subir archivo, obtener URL firmada, eliminar objeto.
   - Usar un único bucket (o varios por tipo: `avatars`, `reportes`, `exportaciones`) según necesidad.

4. **Uso típico:** avatares de usuario, exportaciones CSV/PDF, adjuntos de incidencias o reportes. El frontend llama al backend; el backend sube/descarga desde MinIO y devuelve URL o contenido.

### 2.3 Roadmap A (VPS + opensource)

| Fase | Tarea | Notas |
|------|--------|--------|
| **A.1** | Contratar VPS (Ubuntu 22.04 LTS), SSH, firewall (22, 80, 443) | Documentar IP y usuario |
| **A.2** | Instalar Docker + Docker Compose en el VPS | Mismo `docker-compose` que en desarrollo, con env de prod |
| **A.3** | Añadir MinIO al `docker-compose`, crear bucket(s) inicial(es) | Script o consola MinIO para crear bucket |
| **A.4** | Configurar variables de producción (`.env` en servidor): `DATABASE_URL`, `JWT_SECRET`, `REDIS_*`, `MINIO_*`, `DOMAIN` | No commitear `.env` |
| **A.5** | Levantar stack: `docker compose up -d`, ejecutar `prisma migrate deploy` y opcionalmente seed | Backend y frontend deben usar `NODE_ENV=production` |
| **A.6** | Instalar Nginx como reverse proxy: backend en `:3001`, frontend en `:3000` o servir build estático desde Nginx | Un dominio o subdominio (ej. `api.movilitat.mx`, `app.movilitat.mx`) |
| **A.7** | SSL con Certbot (Let’s Encrypt) para el dominio | Renovación automática |
| **A.8** | Backups: cron para `pg_dump` y (opcional) sync/copia de datos MinIO | Guardar en otro volumen o servicio externo |

---

## 3. Opción B: Cloud y cloud computing (testing / producción)

Ideal para **probar en producción** con poco esfuerzo y sin gestionar un VPS. Incluye usar **Supabase** para Postgres (y opcionalmente auth/storage) y un PaaS para el backend/frontend.

### 3.1 Servicios sugeridos

- **PostgreSQL:** **Supabase** (Postgres gestionado + dashboard, backups, connection pooling). Alternativas: Neon, Railway Postgres, Render Postgres.
- **Redis (si lo usas en prod):** **Upstash Redis** (serverless) o Redis en Railway/Render.
- **Storage (objetos):**  
  - **Supabase Storage** (S3‑compatible), o  
  - **MinIO en un VPS pequeño** solo para MinIO, o  
  - **AWS S3 / Cloudflare R2** si quieres cloud puro.
- **Backend (Node):** **Railway**, **Render** o **Fly.io** (contenedor o servicio Node).
- **Frontend (estático/PWA):** **Vercel**, **Netlify**, **Cloudflare Pages** o el mismo Railway/Render si sirves el build desde el backend. Vercel no exige Next.js: un frontend **Vite** se despliega igual (build: `yarn build`, output: `dist`).

### 3.2 Supabase para Postgres (y más)

- Creas proyecto en [supabase.com](https://supabase.com).
- En **Settings → Database** obtienes:
  - **Connection string** (URI de Postgres): la usas como `DATABASE_URL` en el backend.
  - Modo **Session** (directo) o **Transaction** (pooler); para Prisma suele ir bien el string “direct” (puerto 5432).
- En el backend solo cambias `DATABASE_URL`; Prisma y migraciones funcionan igual (`prisma migrate deploy`).
- Opcional: usar **Supabase Storage** en lugar de MinIO al inicio (API S3‑compatible); más adelante puedes cambiar a MinIO o S3 sin tocar mucho código si abstraes el cliente de storage.

### 3.3 Roadmap B (cloud / testing)

| Fase | Tarea | Notas |
|------|--------|--------|
| **B.1** | Crear cuenta en **Supabase**. Crear proyecto, anotar `DATABASE_URL` (Connection string) | Usar variable “Direct” si Prisma se conecta sin pooler externo |
| **B.2** | En el repo: ejecutar migraciones contra Supabase (`DATABASE_URL` apuntando a Supabase). Opcional: correr seed una vez | `prisma migrate deploy` desde CI o desde tu máquina |
| **B.3** | Crear cuenta en **Railway** (o Render / Fly.io). Conectar el repo (backend) y configurar env: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, etc. | Si usas Redis en prod, añadir Upstash y `REDIS_*` |
| **B.4** | Deploy del backend en Railway/Render/Fly. Comprobar health (`/api/health`) y que la API responde | La URL del backend será algo como `https://tu-app.up.railway.app` |
| **B.5** | Frontend: en **Vercel** (o Netlify/Cloudflare Pages) conectar el repo del frontend. Vite va perfecto (no hace falta Next). Build: `yarn build`, output: `dist`. En env definir `VITE_API_URL` = URL del backend de B.4 | El frontend debe llamar al backend en producción con esa URL |
| **B.6** | Probar flujo completo: login, datos desde Supabase, que el frontend use la API en cloud | Revisar CORS en el backend para el origen del frontend |
| **B.7** | (Opcional) Añadir **Supabase Storage** o MinIO/S3 para archivos; configurar env en el backend y desplegar de nuevo | Misma idea que en A: cliente S3‑compatible y env vars |

---

## 4. Integración MinIO (resumen técnico)

Independientemente de si MinIO está en tu VPS (opción A) o en un pequeño servidor dedicado mientras usas cloud para el resto (híbrido):

1. **Backend:** paquete `@aws-sdk/client-s3` (o `minio`), configurar con:
   - `endpoint`: URL de MinIO (ej. `https://minio.tudominio.com`).
   - `credentials`: access key + secret key.
   - `region`: puede ser `us-east-1` o cualquiera si MinIO no exige región.
2. **Abstracción:** una capa “storage” (ej. `backend/src/lib/storage.ts`) con funciones `upload(buffer, key)`, `getSignedUrl(key)`, `delete(key)`. Así luego puedes cambiar a S3 o Supabase Storage cambiando solo esa capa.
3. **Seguridad:** en producción usar HTTPS para MinIO; en Docker interno puede ser HTTP. No commitear credenciales; solo env vars.

---

## 5. Comparativa rápida

| Criterio | VPS + opensource (A) | Cloud / Supabase (B) |
|----------|----------------------|-----------------------|
| Tiempo hasta “en vivo” | 1–2 días (con experiencia) | 1–2 horas (primera vez) |
| Coste mensual | ~5–20 € (VPS) | 0 € (free tiers) → ~10–30 € al crecer |
| Control y datos | Total (todo en tu máquina) | Compartido (proveedor gestiona DB/storage) |
| MinIO | Nativo en tu Docker | Opcional: MinIO en VPS pequeño o Supabase Storage / S3 |
| Backups | Tú los configuras (cron, scripts) | Supabase/Railway suelen incluir backups básicos |
| Escalar | Añadir RAM/CPU o más VPS | Escalar en el panel del proveedor |

---

## 6. Recomendación práctica

1. **Si nunca has hecho deploy en cloud:** sigue el **Roadmap B**. Crea proyecto en Supabase, usa su Postgres como `DATABASE_URL`, despliega el backend en Railway (o Render) y el frontend en Vercel. En una tarde puedes tener la app de testing en producción.
2. **Cuando quieras bajar coste o tener todo bajo tu control:** usa el **Roadmap A** en un VPS: mismo código, mismo Docker, añadiendo MinIO al compose y Nginx + SSL.
3. **MinIO:** intégralo en el código con una capa de storage (S3‑compatible) desde el principio; así en VPS usas MinIO y en cloud puedes usar Supabase Storage o S3 sin reescribir la lógica de negocio.

---

## 7. Alternativas a Redis (open source)

Si quieres mantener cache/sesión con software 100 % open source y compatible con el protocolo Redis (sin cambiar código del backend), puedes usar:

| Proyecto    | Descripción                          | Sustitución en Docker              |
|------------|--------------------------------------|------------------------------------|
| **Valkey** | Fork de Redis, Linux Foundation, mismo protocolo | Imagen `valkey/valkey`, mismo puerto 6379 |
| **KeyDB**  | Redis-compatible, multihilo          | Imagen `eqalpha/keydb`, mismo puerto |
| **Dragonfly** | Alta velocidad, protocolo Redis    | Imagen `docker.dragonflydb.io/dragonflydb/dragonfly`, mismo puerto |

En los tres casos se usan las mismas variables de entorno (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`) y el mismo cliente en Node (p. ej. `ioredis` o `redis`). Solo cambias la imagen del servicio en `docker-compose.yml`; no hace falta tocar el código.

- **Valkey:** [valkey.io](https://valkey.io) · [GitHub valkey-io/valkey](https://github.com/valkey-io/valkey)
- **KeyDB:** [keydb.dev](https://keydb.dev) · [GitHub Snapchat/KeyDB](https://github.com/Snapchat/KeyDB)
- **Dragonfly:** [dragonflydb.io](https://dragonflydb.io) · [GitHub dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly)

**Memcached** es otra opción open source, pero tiene otra API; habría que cambiar el cliente en el backend (no es sustitución directa).

---

## 8. Referencias

- [Supabase – Database](https://supabase.com/docs/guides/database)
- [MinIO – Docker quickstart](https://min.io/docs/minio/container/index.html)
- [Prisma – Deploy with Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
- [Railway](https://railway.app), [Render](https://render.com), [Fly.io](https://fly.io), [Vercel](https://vercel.com)

Si quieres, el siguiente paso puede ser un documento corto **docs/MINIO-SETUP.md** con el fragmento exacto de `docker-compose` para MinIO y las variables de entorno a añadir al backend.
