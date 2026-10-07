FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_GATEWAY_UI_URL
ENV NEXT_PUBLIC_GATEWAY_UI_URL=$NEXT_PUBLIC_GATEWAY_UI_URL

ARG NEXT_PUBLIC_AUTH_URL=https://auth.mawadao.com
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL

ARG DEPLOYER_URL
ENV DEPLOYER_URL=$DEPLOYER_URL

ARG NEXT_PUBLIC_CLOUD_MODE=true
ENV NEXT_PUBLIC_CLOUD_MODE=$NEXT_PUBLIC_CLOUD_MODE

# CLOUD_MODE is the runtime-safe equivalent (not inlined by Next.js)
ENV CLOUD_MODE=true

ARG NEXT_PUBLIC_ROOT_DOMAIN=mawadao.com
ENV NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN

ARG NEXT_PUBLIC_MEMBER_SPACE_URL=https://agent.mawadao.com
ENV NEXT_PUBLIC_MEMBER_SPACE_URL=$NEXT_PUBLIC_MEMBER_SPACE_URL

ARG NEXT_PUBLIC_SITE_URL=https://agent.mawadao.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

ARG MAWADAO_API_URL
ENV MAWADAO_API_URL=$MAWADAO_API_URL

ARG NEXT_PUBLIC_GATEWAY_TOKEN=1
ENV NEXT_PUBLIC_GATEWAY_TOKEN=$NEXT_PUBLIC_GATEWAY_TOKEN

ARG NEXT_PUBLIC_CONFIG_API_URL
ENV NEXT_PUBLIC_CONFIG_API_URL=$NEXT_PUBLIC_CONFIG_API_URL

ARG NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
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
