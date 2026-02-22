# ===========================================
# Movilitat Backend Dockerfile
# Contexto = raíz del repo (Railway): no pasar nada → SRC=backend
# Contexto = backend/ (docker-compose): build-arg SRC=.
# ===========================================

FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Con contexto = repo root usar SRC=backend; con contexto = backend/ usar SRC=.
ARG SRC=backend

# ===========================================
# Dependencies
# ===========================================
FROM base AS deps

ARG SRC=backend
COPY $SRC/package.json $SRC/yarn.lock* $SRC/package-lock.json* $SRC/pnpm-lock.yaml* ./
COPY $SRC/prisma ./prisma/

RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else npm install; \
  fi

RUN npx prisma generate

# ===========================================
# Builder
# ===========================================
FROM base AS builder

ARG SRC=backend
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY $SRC/ .

# ===========================================
# Runner
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
