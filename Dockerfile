FROM node:20-alpine AS base

# node:20-alpine bundles npm 10.x whose vendored deps carry CVE-2026-59873
# (tar, CRITICAL), CVE-2026-59874, CVE-2026-13149 (brace-expansion),
# CVE-2024-21538 (cross-spawn), CVE-2025-64756 (glob), CVE-2026-26996/-27903/
# -27904 (minimatch), CVE-2026-48815 (sigstore). npm 12 requires node >= 22,
# so pin the newest node-20-compatible npm: 11.18.0 (vendors tar 7.5.19,
# brace-expansion 5.0.7, minimatch 10.2.5, sigstore 4.1.1, glob 13.0.6).
# (CVE-2026-14257 needs brace-expansion 5.0.8, which no npm release vendors yet.)
RUN npm install -g npm@11.18.0

# CVE-2026-45447 (libcrypto3/libssl3 3.5.6-r0 -> 3.5.7-r0): pick up patched
# Alpine base packages instead of waiting for a node:20-alpine rebuild.
RUN apk upgrade --no-cache

# Build frontend
FROM base AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# Production
FROM base AS production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY prisma/ ./prisma/
RUN npx prisma generate

COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p uploads

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node server/index.js"]
