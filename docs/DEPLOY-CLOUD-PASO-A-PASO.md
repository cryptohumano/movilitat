# Deploy en cloud: Backend + Supabase + MinIO (paso a paso)

Guía para dejar Movilitat en la nube usando **Supabase** (Postgres), el **backend** en Railway o Render, y **MinIO** (o Supabase Storage) para archivos. Todo sin VPS propio.

---

## Resumen de servicios

| Qué | Dónde |
|-----|--------|
| **Base de datos** | Supabase (PostgreSQL gestionado) |
| **Backend (Node/Express)** | Railway o Render |
| **Storage (archivos / buckets)** | Opción A: MinIO en Railway · Opción B: Supabase Storage (S3-compatible) |
| **Frontend (Vite)** | Vercel (ver DEPLOY-ROADMAP.md paso B.5) |

---

## Paso 1: Supabase (PostgreSQL)

1. Entra en [supabase.com](https://supabase.com) e inicia sesión (o crea cuenta).
2. **New project**: nombre (ej. `movilitat-prod`), contraseña de base de datos (guárdala), región.
3. Espera a que el proyecto esté listo (1–2 min).
4. En el menú izquierdo: **Settings** (engranaje) → **Database**.
5. En **Connection string** elige **URI** y la pestaña **Session** (conexión directa, puerto 5432).
6. Copia la URI. Tiene esta forma:
   ```text
   postgresql://postgres.[PROJECT-REF]:[TU_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   En **Prisma** suele usarse la conexión **directa** (no pooler). Si ves dos opciones:
   - **Direct connection** (puerto 5432, host tipo `db.xxx.supabase.co`) → mejor para Prisma.
   - **Transaction pooler** (puerto 6543) → a veces da problemas con migraciones; puedes probar la directa primero.
7. Crea una variable local con esa URI para no pegarla en el repo:
   ```bash
   export DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@db.xxxx.supabase.co:5432/postgres"
   ```
   (Sustituye por tu URI real.)

---

## Paso 2: Migraciones y seed contra Supabase

Desde la raíz del repo (o desde `backend` si prefieres):

1. **Solo esta vez**, apunta Prisma a Supabase:
   ```bash
   cd backend
   export DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@db.xxxx.supabase.co:5432/postgres"
   yarn prisma migrate deploy
   ```
   Si usas el `.env` del backend, puedes poner ahí `DATABASE_URL` de Supabase solo para este paso y luego quitarla (o usar otro `.env.cloud`).

2. **(Opcional)** Cargar datos iniciales:
   ```bash
   yarn prisma:seed
   ```
   (Solo si tu seed está listo para producción.)

3. Comprueba en Supabase: **Table Editor** → deberías ver las tablas creadas por las migraciones.

Desde aquí, **no vuelvas a usar** la base local para producción. El backend en cloud usará la misma `DATABASE_URL` que configurarás en Railway/Render.

---

## Paso 3: Backend en Railway (recomendado) o Render

### 3.1 Railway

1. Entra en [railway.app](https://railway.app) e inicia sesión (p. ej. con GitHub).
2. **New Project** → **Deploy from GitHub repo**. Conecta el repo de Movilitat.
3. Railway puede detectar el monorepo. Debes indicar que el servicio es el **backend**:
   - **Root Directory:** `backend`
   - **Build Command:** `yarn install && yarn prisma generate && yarn build`  
     (o `npm install && npx prisma generate && npm run build` si usas npm.)
   - **Start Command:** `yarn prisma migrate deploy && node dist/index.js`  
     (o `npx prisma migrate deploy && node dist/index.js`.)  
     Así aplicas migraciones en cada deploy y luego arrancas el servidor.
   - **Watch Paths:** `backend/**` (para que solo redepliegue cuando cambie el backend).
4. Añade variables de entorno en **Variables** (o en **Settings** del servicio):
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = la URI de Supabase del Paso 1 (Session/Direct).
   - `JWT_SECRET` = un secreto largo y aleatorio (genera uno y no lo compartas).
   - `JWT_EXPIRES_IN` = `7d` (o lo que uses).
   - **Puerto:** no hace falta configurarlo; Railway y Render inyectan `PORT` y el backend ya usa `process.env.PORT || process.env.BACKEND_PORT || 3001`.
   - **CORS:** el frontend estará en Vercel, así que necesitas que el backend acepte ese origen. Añade:
     - `DOMAIN` = dominio del frontend en producción, ej. `movilitat.vercel.app` o `app.movilitat.mx`.  
     (Tu código usa `https://${process.env.DOMAIN}` para CORS en producción; si tu front es `movilitat.vercel.app`, pon exactamente eso.)
   - Si más adelante añades Redis en cloud: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (ej. Upstash).
5. Deploy: Railway construye y despliega. En **Settings** → **Networking** crea un **Public URL** (ej. `movilitat-api.up.railway.app`).
6. Prueba: `https://tu-url.up.railway.app/api/health` → debe responder JSON con `status: 'ok'`.

### 3.2 Render (alternativa)

1. [render.com](https://render.com) → **New** → **Web Service**.
2. Conecta el repo. **Root Directory:** `backend`.
3. **Build:** `yarn install && yarn prisma generate && yarn build`.
4. **Start:** `yarn prisma migrate deploy && node dist/index.js`.
5. En **Environment** añade las mismas variables que arriba (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `DOMAIN`, etc.).
6. Crea el servicio; Render asigna una URL. Comprueba `/api/health`.

---

## Paso 4: Storage en cloud (MinIO o Supabase Storage)

Tienes dos opciones: MinIO alojado en cloud (p. ej. en Railway) o Supabase Storage (S3-compatible). El backend usará en ambos casos un cliente S3 (o la API de Supabase Storage).

### Opción A: MinIO en Railway

1. En el mismo proyecto de Railway (o otro), **New** → **Empty Service** o **Deploy from Dockerfile**.
2. Usa la imagen oficial de MinIO. En Railway suele hacerse con un **Dockerfile** mínimo:
   ```dockerfile
   FROM minio/minio:latest
   ENV MINIO_ROOT_USER=movilitat_minio
   ENV MINIO_ROOT_PASSWORD=un_password_muy_seguro
   CMD ["server", "/data"]
   ```
   O en **Settings** del servicio, configura **Docker** con imagen `minio/minio`, command `server /data`, y las variables `MINIO_ROOT_USER` y `MINIO_ROOT_PASSWORD`.
3. En **Networking** genera una URL pública para ese servicio (ej. `movilitat-minio.up.railway.app`). MinIO suele usar el puerto 9000.
4. Crea un bucket desde la consola MinIO (puerto 9001 si está expuesto) o con un script que use el SDK. Nombre sugerido: `movilitat-uploads`.
5. En el **backend** (Railway), añade variables:
   - `MINIO_ENDPOINT` = `https://movilitat-minio.up.railway.app` (tu URL pública)
   - `MINIO_ACCESS_KEY` = mismo que `MINIO_ROOT_USER`
   - `MINIO_SECRET_KEY` = mismo que `MINIO_ROOT_PASSWORD`
   - `MINIO_BUCKET` = `movilitat-uploads`
6. Implementa en el backend la capa de storage (ver `docs/MINIO-SETUP.md`) usando `@aws-sdk/client-s3` con ese endpoint. Redeploy del backend.

### Opción B: Supabase Storage (S3-compatible)

1. En tu proyecto Supabase: **Storage** en el menú → **New bucket** (ej. `movilitat-uploads`). Configura políticas (público o privado según necesites).
2. **Settings** → **API**: anota **Project URL** y **anon** / **service_role** key. Para el backend suele usarse **service_role** para acceso total desde el servidor.
3. Supabase Storage expone una API S3-compatible. Endpoint típico:
   ```text
   https://[PROJECT_REF].supabase.co/storage/v1/s3
   ```
   (Revisa la doc actual de Supabase por si el path cambia.)
4. En el backend (Railway/Render) añade:
   - `MINIO_ENDPOINT` = `https://[PROJECT_REF].supabase.co/storage/v1/s3`
   - `MINIO_ACCESS_KEY` = acceso S3 que te da Supabase (en Storage → Configuration o API).
   - `MINIO_SECRET_KEY` = secreto S3 de Supabase.
   - `MINIO_BUCKET` = `movilitat-uploads`.
   Con el mismo código S3 (cliente AWS SDK apuntando a ese endpoint) funcionará igual que con MinIO.

Si Supabase no te da aún credenciales S3 en la UI, puedes usar su REST API de Storage desde Node en lugar del SDK S3; en ese caso la capa `backend/src/lib/storage.ts` tendría una implementación que llame a `https://[PROJECT_REF].supabase.co/storage/v1/object/...` con el header `Authorization: Bearer SERVICE_ROLE_KEY`. La ventaja de usar el endpoint S3 de Supabase (si está disponible) es no tocar la lógica de la app.

---

## Paso 5: CORS y frontend

1. En el backend (Railway/Render) la variable **DOMAIN** debe ser el dominio desde el que se sirve el frontend en producción:
   - Si el front está en Vercel con URL `https://movilitat.vercel.app`, pon `DOMAIN=movilitat.vercel.app` (sin `https://`).
   - Si usas dominio propio en Vercel, p. ej. `app.movilitat.mx`, pon `DOMAIN=app.movilitat.mx`.
2. Así el backend responderá con `Access-Control-Allow-Origin: https://app.movilitat.mx` (o la que sea) y el navegador permitirá las peticiones desde el frontend.

---

## Paso 6: Frontend (Vite) en Vercel

### 6.1 Crear el proyecto en Vercel

1. Entra en [vercel.com](https://vercel.com) e inicia sesión (con GitHub, GitLab o Bitbucket).
2. **Add New** → **Project**.
3. **Import** el repositorio de Movilitat (si no está, conéctalo antes desde **Settings** → **Git Integrations**).
4. Antes de hacer **Deploy**, configura lo siguiente.

### 6.2 Configuración del build

- **Framework Preset:** Vite (Vercel lo detecta si existe `vite.config` en la carpeta del proyecto).
- **Root Directory:** `frontend`.  
  En un monorepo es obligatorio indicar esta carpeta para que Vercel construya solo el frontend.
- **Build Command:** `yarn build` (o `npm run build`). Se ejecuta dentro de `frontend`.
- **Output Directory:** `dist` (salida por defecto de Vite).
- **Install Command:** `yarn install` (o `npm ci`). Por defecto Vercel instala dependencias dentro de `frontend` cuando Root Directory es `frontend`.

### 6.3 Variable de entorno: conectar con el backend

- En **Environment Variables** añade:
  - **Name:** `VITE_API_URL`
  - **Value:** URL base del API **incluyendo** `/api`, sin barra final.  
    Ejemplos:
  - Railway: `https://movilitat-api.up.railway.app/api`
  - Render: `https://movilitat-api.onrender.com/api`
- **Importante:** en Vite las variables `VITE_*` se embeben en el build en el momento de compilar. Si luego cambias la URL del backend, hay que **redeployar** el frontend en Vercel (o cambiar la variable y hacer **Redeploy**).

### 6.4 Deploy

1. Pulsa **Deploy**. Vercel construye el frontend y lo publica.
2. Te asigna una URL tipo `movilitat-xxx.vercel.app` (o el nombre del repo). Si añades un **dominio propio** (p. ej. `app.movilitat.mx`), configúralo en **Settings** → **Domains**.
3. Esa URL (o tu dominio) es la que debes usar como **DOMAIN** en el backend (Paso 5) para que CORS permita las peticiones. Sin eso, el navegador bloqueará las llamadas al API.

---

## Cómo se conecta el frontend con el backend

1. **En tiempo de build (Vercel):**  
   La variable `VITE_API_URL` se lee durante `yarn build` y se sustituye en el código. En el frontend, `frontend/src/lib/api.ts` hace:
   ```ts
   const API_URL = import.meta.env.VITE_API_URL || '/api';
   ```
   En producción, `API_URL` será exactamente la URL que pusiste en `VITE_API_URL` (ej. `https://movilitat-api.up.railway.app/api`). Todas las peticiones (login, dashboard, check-ins, etc.) usan ese cliente y van a esa base.

2. **En el navegador:**  
   Cada acción (login, listar rutas, hacer check-in, etc.) llama a `api.get(...)` o `api.post(...)`. Esas funciones hacen `fetch(API_URL + ruta, ...)`, es decir `fetch('https://movilitat-api.up.railway.app/api/auth/login', ...)`. El backend (Railway/Render) recibe la petición, responde y el frontend muestra los datos.

3. **CORS:**  
   El backend solo acepta peticiones desde orígenes permitidos. En producción usa `origin: ['https://' + process.env.DOMAIN]`. Por tanto, **DOMAIN** en el backend debe ser exactamente el host del frontend:
   - Si el front está en `https://movilitat.vercel.app` → `DOMAIN=movilitat.vercel.app`
   - Si usas dominio propio en Vercel, p. ej. `https://app.movilitat.mx` → `DOMAIN=app.movilitat.mx`  
   Sin esto, el navegador verá que el backend no incluye el origen del front en `Access-Control-Allow-Origin` y bloqueará las peticiones (error CORS en consola).  
   **Nota:** Si usas **preview deployments** de Vercel (otras ramas), cada uno tiene un host distinto (ej. `movilitat-git-rama.vercel.app`). Para que funcionen contra el mismo backend tendrías que permitir varios orígenes en el backend (p. ej. una lista `DOMAIN` con varios hosts o un patrón); en desarrollo suele bastar con configurar CORS solo para el dominio de producción.

4. **Resumen:**  
   - Frontend (Vercel): `VITE_API_URL` = URL del backend + `/api` → todas las llamadas van ahí.  
   - Backend (Railway/Render): `DOMAIN` = host del frontend (sin `https://`) → CORS permite ese origen.  
   - El frontend **nunca** habla directo con Supabase ni MinIO; todo pasa por tu API en el backend.

---

## Checklist rápido

- [ ] Proyecto Supabase creado; `DATABASE_URL` (Session/Direct) copiada.
- [ ] `prisma migrate deploy` y opcionalmente `prisma:seed` contra Supabase.
- [ ] Backend desplegado en Railway (o Render) con `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `DOMAIN`.
- [ ] `/api/health` responde OK.
- [ ] MinIO (Railway) o Supabase Storage configurado; variables `MINIO_*` (o equivalente) en el backend; capa storage implementada si aún no está.
- [ ] `DOMAIN` en el backend = host del frontend en Vercel (ej. `movilitat.vercel.app` o `app.movilitat.mx`) para CORS.
- [ ] Frontend en Vercel: Root `frontend`, build `yarn build`, output `dist`, variable `VITE_API_URL` = URL del backend + `/api`.
- [ ] Prueba de login y flujo completo contra producción (el front llama al backend, el backend a Supabase).

Si algo falla, revisa logs del backend en Railway/Render y que `DATABASE_URL` no tenga caracteres rotos al pegarla (sobre todo la contraseña). Para más contexto general, ver [DEPLOY-ROADMAP.md](./DEPLOY-ROADMAP.md) y [MINIO-SETUP.md](./MINIO-SETUP.md).
