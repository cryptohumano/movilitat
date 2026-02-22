# Desplegar todo en Railway

Guía para desplegar **backend** y **frontend** del monorepo en [Railway](https://railway.app), con base de datos en Supabase (o Postgres de Railway) y variables listas para producción.

---

## Requisitos previos

- Cuenta en [Railway](https://railway.app) (GitHub login).
- Base PostgreSQL en cloud: **Supabase** (recomendado) o **Railway Postgres**. Tener `DATABASE_URL` lista.
- Repo conectado a Railway (GitHub).

---

## 1. Estructura del monorepo en Railway

El proyecto es un **monorepo Yarn** con dos servicios desplegables:

| Servicio   | Carpeta   | Puerto (env `PORT` lo inyecta Railway) |
|-----------|-----------|----------------------------------------|
| Backend   | `backend/`  | 3001 por defecto (usa `process.env.PORT`) |
| Frontend  | `frontend/` | 3000 por defecto (usa `PORT` en `serve`) |

Railway puede **importar el repo** y detectar los dos paquetes. Usa los `railway.toml` en `backend/` y `frontend/` para build y start.

---

## 2. Configuración por servicio

### 2.1 Importar el proyecto

1. En Railway: **New Project** → **Deploy from GitHub repo**.
2. Elige el repositorio del proyecto.
3. Si Railway detecta el monorepo, te ofrecerá **dos servicios** (backend y frontend). Créalos ambos.

Si no los detecta, crea **dos servicios** a mano y en cada uno:
- Conecta el mismo repo.
- **Root Directory:** déjalo **vacío** (raíz del repo) para que funcionen los comandos `yarn workspace ...`.
- **Config file (opcional):** en cada servicio puedes apuntar al config del paquete:
  - Backend: **Railway config path** = `/backend/railway.toml`
  - Frontend: **Railway config path** = `/frontend/railway.toml`

Así se usan los `buildCommand` y `startCommand` definidos en esos archivos.

---

### 2.2 Servicio Backend

- **Build (desde raíz):**  
  `yarn install && yarn workspace backend run prisma:generate && yarn workspace backend run build`
- **Start:**  
  `yarn start:backend`  
  (ejecuta migraciones y luego `node dist/index.js`)

Variables de entorno **obligatorias** en Railway (pestaña Variables del servicio):

| Variable       | Ejemplo / valor |
|----------------|------------------|
| `NODE_ENV`     | `production` |
| `DATABASE_URL` | `postgresql://usuario:password@host:5432/db` (Supabase o Railway Postgres) |
| `JWT_SECRET`   | Una cadena larga y aleatoria (no compartir) |
| `JWT_EXPIRES_IN` | `7d` (opcional) |
| `DOMAIN`       | Dominio del frontend **sin** `https://` (ej. `transporte-production.up.railway.app`). Varios orígenes: separar por comas (ej. `app.railway.app,app.tudominio.com`). |

**CORS:** El backend permite en producción solo el origen `https://${DOMAIN}`. `DOMAIN` debe ser exactamente el host donde esté el frontend (el que asigne Railway al servicio frontend o tu dominio propio).

Opcionales:

- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` si usas Redis (p. ej. Upstash).
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` si usas MinIO/S3.

En **Settings** → **Networking** del servicio backend: genera una **Public URL** (ej. `https://movilitat-backend.up.railway.app`). Esa URL será la base del API (añade `/api` para health: `https://.../api/health`).

---

### 2.3 Servicio Frontend

- **Build (desde raíz):**  
  `yarn install && yarn workspace frontend run build`
- **Start:**  
  `yarn start:frontend`  
  (sirve la carpeta `frontend/dist` con `serve` en el `PORT` que inyecte Railway)

Variable de entorno **obligatoria** en el servicio frontend:

| Variable        | Valor |
|-----------------|--------|
| `VITE_API_URL`  | URL base del API **con** `/api`, sin barra final. Ej: `https://movilitat-backend.up.railway.app/api` |

Importante: en Vite las variables `VITE_*` se embeben en el build. Si cambias la URL del backend, hay que **redeployar** el frontend.

En **Settings** → **Networking** del servicio frontend: genera una **Public URL**. Esa URL (o tu dominio) es la que debes poner en **Backend** como `DOMAIN` (solo el host, sin `https://`).

---

## 3. Orden recomendado

1. Tener **Postgres** (Supabase o Railway) y `DATABASE_URL`.
2. **Migraciones:** una vez, desde tu máquina o desde un job:
   ```bash
   cd backend && DATABASE_URL="tu_url" yarn prisma migrate deploy
   ```
   (Opcional: `yarn prisma:seed` si tienes seed para producción.)
3. Crear en Railway el **servicio Backend**, configurar variables (sobre todo `DATABASE_URL`, `JWT_SECRET`, `DOMAIN`), asignar Public URL y hacer deploy.
4. Probar: `https://TU-BACKEND-URL/api/health` → debe devolver `{"status":"ok",...}`.
5. Crear el **servicio Frontend**, poner `VITE_API_URL = https://TU-BACKEND-URL/api`, asignar Public URL y hacer deploy.
6. En el **Backend**, asegurarte de que `DOMAIN` sea exactamente el host del frontend (ej. el que te dio Railway para el frontend). Redeploy del backend si cambiaste `DOMAIN`.
7. Probar login y flujo completo desde la URL del frontend.

---

## 4. Watch Paths (opcional)

Para que un cambio en `backend/` no dispare deploy del frontend y viceversa:

- En el **servicio Backend**: **Watch Paths** = `backend/**`
- En el **servicio Frontend**: **Watch Paths** = `frontend/**`

Así solo se redespliega el servicio cuyo código cambió.

---

## 5. Resumen de comprobaciones

- [ ] Postgres en cloud con `DATABASE_URL`; migraciones aplicadas.
- [ ] Backend en Railway con `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `DOMAIN` (host del frontend).
- [ ] Backend con Public URL; `/api/health` responde OK.
- [ ] Frontend en Railway con `VITE_API_URL` = URL del backend + `/api`.
- [ ] Frontend con Public URL; `DOMAIN` en backend = host de esa URL (o tu dominio).
- [ ] Prueba de login y uso de la app contra las URLs de producción.

Si algo falla, revisa los **logs** del servicio en Railway y que `DATABASE_URL` y `DOMAIN` no tengan caracteres rotos o espacios. Para más contexto: [DEPLOY-CLOUD-PASO-A-PASO.md](./DEPLOY-CLOUD-PASO-A-PASO.md) y [DEPLOY-ROADMAP.md](./DEPLOY-ROADMAP.md).
