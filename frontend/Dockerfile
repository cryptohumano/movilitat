# ===========================================
# Movilitat Frontend Dockerfile
# Vite 7 + React + TypeScript
# ===========================================

FROM node:20-alpine AS base

RUN corepack enable && corepack prepare yarn@4.6.0 --activate

WORKDIR /app

# ===========================================
# Dependencies
# ===========================================
FROM base AS deps

COPY package.json yarn.lock .yarnrc.yml ./

RUN yarn install --immutable

# ===========================================
# Builder
# ===========================================
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN yarn build

# ===========================================
# Production - Nginx
# ===========================================
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
