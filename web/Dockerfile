# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# API_URL: resolvido em build para o rewrite do next.config.ts
# MAESTRO_API_KEY e NEXT_PUBLIC_ADMIN_KEY: injetados em RUNTIME via docker-compose
# (não entram na imagem — sem risco de exposição em repos públicos)
ARG API_URL=http://localhost:3001
ENV API_URL=$API_URL

RUN --mount=type=cache,target=/root/.npm \
    npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# MAESTRO_API_KEY é injetado via docker-compose em runtime (process.env em Server Components)
CMD ["node", "server.js"]
