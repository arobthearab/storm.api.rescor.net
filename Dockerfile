# STORM API
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

ARG NODE_AUTH_TOKEN

COPY .npmrc ./
COPY package*.json ./

RUN NODE_AUTH_TOKEN=${NODE_AUTH_TOKEN} npm ci --only=production && npm cache clean --force

COPY src/ ./src/

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3200

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3200/health || exit 1

CMD ["node", "src/index.mjs"]
