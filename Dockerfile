# Multi-stage production build for Next.js 15 App Router
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install system deps if needed (e.g., sharp)
# RUN apk add --no-cache libc6-compat

# Install dependencies separately to leverage Docker layer caching
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm@9 && pnpm i --frozen-lockfile; \
  else npm i; fi

# Copy the rest of the repo
COPY . .

# Build Next.js app (uses next.config.ts with output: standalone)
RUN npm run build

# Stage 2: Runner (lean image)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Set a non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy the standalone server output and static assets
# .next/standalone includes the server and production deps, .next/static contains client assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose and default start command for Next.js
ENV PORT=3000
EXPOSE 3000

# Ensure Next.js can find the compiled server
# The standalone folder contains a server.js and package.json at the root
USER nextjs
CMD ["node", "server.js"]