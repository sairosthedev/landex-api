FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY src ./src

FROM node:20-alpine AS runtime

RUN apk add --no-cache curl \
    && addgroup -S landex \
    && adduser -S landex -G landex -u 10001

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/src ./src

RUN mkdir -p /data/storage \
    && chown -R landex:landex /app /data/storage

USER landex

ENV NODE_ENV=production \
    PORT=8080 \
    STORAGE_BASE_PATH=/data/storage

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8080}/health" || exit 1

CMD ["node", "src/server.js"]
