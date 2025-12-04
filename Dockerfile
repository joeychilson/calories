FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM oven/bun:1-slim AS production

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --production

COPY --from=builder /app/build ./build

COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib/server/schema.ts ./src/lib/server/schema.ts

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "run", "build/index.js"]
