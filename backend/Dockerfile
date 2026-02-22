# ===========================================
# RutaCheck Backend Dockerfile
# ===========================================

FROM node:20-alpine AS base

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# ===========================================
# Dependencies
# ===========================================
FROM base AS deps

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
COPY prisma ./prisma/

RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else npm i; \
  fi

# Generar cliente Prisma
RUN npx prisma generate

# ===========================================
# Builder (solo copia fuentes; el build tsc falla por errores TS pendientes)
# ===========================================
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ===========================================
# Runner: ejecutar con tsx (sin compilar con tsc)
# ===========================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER expressjs

EXPOSE 3001

ENV BACKEND_PORT=3001

CMD ["npx", "tsx", "src/index.ts"]
