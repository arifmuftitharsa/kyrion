# syntax=docker/dockerfile:1
# Dockerfile diperkeras Kyrion (sec-0.2). Satu Dockerfile untuk semua lingkungan.
# Image dasar di-pin dengan digest (diambil 2026-11-01 lewat docker pull node:24-alpine).
ARG NODE_IMAGE=node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

# Tahap deps: semua dependensi (termasuk dev) untuk build dan alat migrate/seed.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Tahap build: kompilasi Next.js dan client Prisma. DATABASE_URL tiruan hanya hidup selama perintah ini.
FROM deps AS build
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
 && DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build \
 && rm -rf .next/cache

# Tahap proddeps: hanya dependensi produksi, tanpa skrip instalasi.
FROM ${NODE_IMAGE} AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Tahap tools: migrate dan seed sekali jalan (bukan layanan). Berjalan sebagai non-root.
FROM build AS tools
RUN addgroup -g 10001 -S kyrion && adduser -S -u 10001 -G kyrion -H -s /sbin/nologin kyrion
ENV HOME=/tmp NODE_ENV=production
USER 10001:10001
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# Tahap runtime: image akhir. Tanpa npm, tanpa dependensi dev, berjalan sebagai UID 10001.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -g 10001 -S kyrion \
 && adduser -S -u 10001 -G kyrion -H -s /sbin/nologin kyrion \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && mkdir -p /app/storage /app/.next/cache \
 && chown 10001:10001 /app/storage /app/.next/cache
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/generated ./generated
COPY --from=build /app/public ./public
COPY package.json next.config.ts tsconfig.json ./
USER 10001:10001
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
