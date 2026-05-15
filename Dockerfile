# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
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
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
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

RUN npm prune --omit=dev \
  && chmod +x /app/deploy/docker-cron-loop.sh

EXPOSE 3000
CMD ["npm", "run", "start:docker"]
