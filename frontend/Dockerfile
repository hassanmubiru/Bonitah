# Multi-stage Dockerfile for BFN Frontend
# Builds a production-ready Next.js application

# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy shared package
COPY shared/ ./shared/

# Copy frontend source
COPY frontend/package.json ./frontend/
COPY frontend/tsconfig*.json ./frontend/
COPY frontend/tailwind.config.ts ./frontend/
COPY frontend/next.config.ts ./frontend/
COPY frontend/postcss.config.mjs ./frontend/
COPY frontend/components.json ./frontend/
COPY frontend/public/ ./frontend/public/
COPY frontend/src/ ./frontend/src/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package
WORKDIR /app/shared
RUN pnpm build

# Build frontend
WORKDIR /app/frontend
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm@9

# Install curl for healthchecks
RUN apk add --no-cache curl

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S frontend -u 1001

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy shared package
COPY shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist/

# Copy frontend files
COPY frontend/package.json ./frontend/
COPY frontend/next.config.ts ./frontend/
COPY frontend/public/ ./frontend/public/
COPY --from=builder /app/frontend/.next/standalone ./frontend/
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Switch to non-root user
USER nodejs

WORKDIR /app/frontend

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Start the application
CMD ["pnpm", "start"]