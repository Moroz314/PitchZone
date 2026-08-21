FROM node:22-alpine AS builder
WORKDIR /app

# Copy root config
COPY package*.json ./
COPY turbo.json ./

# Copy packages and apps
COPY packages ./packages
COPY apps/web ./apps/web

# Install dependencies for all workspaces
RUN npm install

# Build Web
WORKDIR /app
# Pass Next build env vars here if needed
ENV NEXT_TELEMETRY_DISABLED 1
RUN npx turbo run build --filter=@pitchzone/web

FROM node:22-alpine AS runner
WORKDIR /app/apps/web
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy built Next.js assets
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/standalone ../../
COPY --from=builder /app/apps/web/.next/static ./.next/static

EXPOSE 3000

# Next.js standalone output uses server.js
CMD ["node", "server.js"]
