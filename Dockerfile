
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev:docker"]

FROM deps AS builder
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_USE_SERVER_DATA=1
ARG NEXT_PUBLIC_BASE_PATH=
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_ADSENSE_ID=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_USE_SERVER_DATA=$NEXT_PUBLIC_USE_SERVER_DATA
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_ADSENSE_ID=$NEXT_PUBLIC_ADSENSE_ID
COPY . .
ENV RESET_SOURCES_ENABLED=0
RUN ./node_modules/.bin/tsc lib/reset-feed-core.ts lib/advertising.ts lib/adsense-gate.ts --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir /tmp/releaselog-unit
RUN COMPILED_TEST_LIBS=/tmp/releaselog-unit node --test scripts/site-refresh-tests.cjs scripts/adsense-gate-tests.cjs
RUN node --test scripts/ai-autonomy.test.mjs
RUN node scripts/validate-editorial.mjs
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
  && apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/deploy/docker-cron-loop.sh ./deploy/docker-cron-loop.sh

RUN npm prune --omit=dev --no-audit --fund=false \
  && chmod +x /app/deploy/docker-cron-loop.sh

EXPOSE 3000
CMD ["npm", "run", "start:docker"]
