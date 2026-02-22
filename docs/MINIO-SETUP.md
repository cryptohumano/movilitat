# Configuración de MinIO para Movilitat

Pasos concretos para integrar MinIO (storage S3-compatible) en el proyecto, tanto en desarrollo (Docker) como en producción.

---

## 1. MinIO en Docker Compose (ya incluido)

El servicio MinIO está definido en `docker/docker-compose.yml` (entre Redis y backend). Usa la imagen **minio/minio:latest**.

**Levantar el stack** (Compose V2, comando sin guión):

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

O desde la raíz del repo: `yarn docker:up`.

- **API MinIO:** `http://localhost:9000`
- **Consola web:** `http://localhost:9001` (usuario/contraseña: `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` del `.env`)

**Crear bucket por defecto:** la primera vez, entra en la consola (`http://localhost:9001`), crea un bucket (ej. `movilitat-uploads`). Si el backend ya usa `MINIO_BUCKET=movilitat-uploads`, ese debe ser el nombre.

---

## 2. Variables de entorno

Añadir a `.env.example` y al `.env` de desarrollo/producción:

```bash
# MinIO (Storage S3-compatible)
MINIO_ENDPOINT=http://localhost:9000
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER=movilitat_minio
MINIO_ROOT_PASSWORD=movilitat_minio_secret_2026
MINIO_BUCKET=movilitat-uploads
# En producción con Nginx/SSL: MINIO_ENDPOINT=https://minio.tudominio.com
```

En **Docker Compose** (backend) pasar al backend:

```yaml
environment:
  # ... existentes ...
  MINIO_ENDPOINT: http://minio:9000
  MINIO_ACCESS_KEY: ${MINIO_ROOT_USER:-movilitat_minio}
  MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-movilitat_minio_secret_2026}
  MINIO_BUCKET: ${MINIO_BUCKET:-movilitat-uploads}
```

---

## 3. Backend: cliente S3 y capa de storage

1. **Instalar SDK S3-compatible** (funciona con MinIO):

```bash
cd backend && yarn add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

2. **Crear `backend/src/lib/storage.ts`** (ejemplo mínimo):

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.MINIO_ENDPOINT;
const bucket = process.env.MINIO_BUCKET ?? 'movilitat-uploads';

const client = endpoint
  ? new S3Client({
      endpoint,
      region: process.env.MINIO_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? '',
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? '',
      },
      forcePathStyle: true,
    })
  : null;

export async function uploadBuffer(key: string, body: Buffer, contentType?: string): Promise<string> {
  if (!client || !bucket) throw new Error('MinIO not configured');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  if (!client || !bucket) throw new Error('MinIO not configured');
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  if (!client || !bucket) return;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
```

3. **Uso en rutas:** por ejemplo en `auth.routes.ts` o una ruta de “upload avatar”: leer `req.file` o `req.body` (según middleware), llamar a `uploadBuffer('avatars/' + userId, buffer, mimeType)` y guardar la key en el usuario en Postgres; para descargar, usar `getSignedDownloadUrl(key)`.

---

## 4. Producción (VPS)

- Exponer MinIO detrás de Nginx con HTTPS (subdominio ej. `minio.movilitat.mx`) o dejar solo en red interna y que el backend hable con `http://minio:9000`.
- Usar `MINIO_ROOT_USER` y `MINIO_ROOT_PASSWORD` fuertes y solo en variables de entorno, nunca en el repo.

Con esto tienes el camino listo para integrar buckets MinIO en el proyecto; el roadmap general está en [DEPLOY-ROADMAP.md](./DEPLOY-ROADMAP.md).
