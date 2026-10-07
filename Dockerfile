FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://configuration-api-375390721933.europe-west1.run.app/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_OPENCLAW_URL=https://tenant-platform-375390721933.europe-west1.run.app
ENV NEXT_PUBLIC_OPENCLAW_URL=$NEXT_PUBLIC_OPENCLAW_URL

ARG NEXT_PUBLIC_AUTH_URL=https://auth.barrsa.com
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL

ARG CLOUD_RUN_DEPLOYER_URL=https://cloud-run-deployer-375390721933.europe-west1.run.app/api/v1
ENV CLOUD_RUN_DEPLOYER_URL=$CLOUD_RUN_DEPLOYER_URL

ARG NEXT_PUBLIC_CLOUD_MODE=true
ENV NEXT_PUBLIC_CLOUD_MODE=$NEXT_PUBLIC_CLOUD_MODE

# CLOUD_MODE is the runtime-safe equivalent (not inlined by Next.js)
ENV CLOUD_MODE=true

ARG NEXT_PUBLIC_ROOT_DOMAIN=barrsa.com
ENV NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN

ARG BARRSA_API_URL=https://configuration-api-375390721933.europe-west1.run.app/api/v1
ENV BARRSA_API_URL=$BARRSA_API_URL

ARG NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN=1
ENV NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN=$NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN

ARG NEXT_PUBLIC_CONFIG_API_URL=https://configuration-api-git-375390721933.europe-west1.run.app/api/v1
ENV NEXT_PUBLIC_CONFIG_API_URL=$NEXT_PUBLIC_CONFIG_API_URL

ARG NEXT_PUBLIC_OPENCLAW_GATEWAY_URL=https://configuration-api-git-375390721933.europe-west1.run.app
ENV NEXT_PUBLIC_OPENCLAW_GATEWAY_URL=$NEXT_PUBLIC_OPENCLAW_GATEWAY_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
