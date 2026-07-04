# ============================================================
# OsintFlow — Dockerfile (multi-stage, Next.js standalone + Prisma)
# ============================================================

# ---- Stage 1: deps ----
FROM node:20-slim AS deps
WORKDIR /app

# OpenSSL is required by Prisma on Debian-based images.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Bun is used as the package manager in this project.
RUN npm install -g bun

COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install dependencies (including devDependencies needed for build).
RUN bun install --frozen-lockfile || bun install

# Generate the Prisma client.
RUN bunx prisma generate

# ---- Stage 2: build ----
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g bun

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/db/custom.db"

# Build the Next.js standalone output.
RUN bun run build

# ---- Stage 3: runner ----
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Default database location — mounted as a volume in docker-compose.
ENV DATABASE_URL="file:/app/data/osintflow.db"

# Create the data directory for the SQLite database.
RUN mkdir -p /app/data

# Copy the standalone server output.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + generated client so we can run db push on startup.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Entrypoint: push the schema to the SQLite DB, then start the server.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

CMD ["/app/docker-entrypoint.sh"]
