# Multi-stage Dockerfile for BFN Backend
# Builds a production-ready NestJS application

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

# Copy backend source
COPY backend/package.json ./backend/
COPY backend/tsconfig*.json ./backend/
COPY backend/nest-cli.json ./backend/
COPY backend/prisma/ ./backend/prisma/
COPY backend/src/ ./backend/src/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
WORKDIR /app/backend
RUN pnpm prisma:generate

# Build shared package
WORKDIR /app/shared
RUN pnpm build

# Build backend
WORKDIR /app/backend
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm@9

# Install curl for healthchecks
RUN apk add --no-cache curl

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy shared package
COPY shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist/

# Copy backend files
COPY backend/package.json ./backend/
COPY backend/prisma/ ./backend/prisma/
COPY --from=builder /app/backend/dist ./backend/dist/
COPY --from=builder /app/backend/node_modules/.prisma ./backend/node_modules/.prisma/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Create logs directory
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

WORKDIR /app/backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["pnpm", "start:prod"]