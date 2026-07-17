# Production image for the Hono API server.
# Multi-stage: install deps in a builder, ship a slim runtime.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
# Uncomment when the project uses Prisma (or similar codegen).
# COPY prisma ./prisma
# RUN bunx prisma generate
EXPOSE 3000
USER bun
CMD ["bun", "run", "start"]
