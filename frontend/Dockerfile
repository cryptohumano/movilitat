# ===========================================
# Movilitat Frontend Dockerfile (monorepo root context)
# Vite + React + TypeScript
# ===========================================

FROM node:20-alpine AS base

RUN corepack enable && corepack prepare yarn@4.6.0 --activate

WORKDIR /app

# ===========================================
# Dependencies (monorepo completo para workspaces)
# ===========================================
FROM base AS deps

COPY package.json yarn.lock .yarnrc.yml* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN yarn install --immutable

# ===========================================
# Builder
# ===========================================
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN yarn workspace frontend build

# ===========================================
# Production - Nginx
# ===========================================
FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
