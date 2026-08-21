FROM node:22-alpine AS builder
WORKDIR /app

# Copy root config
COPY package*.json ./
COPY turbo.json ./

# Copy packages and apps
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies for all workspaces
RUN npm install

# Generate Prisma Client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build API
WORKDIR /app
RUN npx turbo run build --filter=@pitchzone/api

FROM node:22-alpine AS runner
WORKDIR /app

# Copy built assets and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3001

CMD ["npm", "run", "start:prod"]
