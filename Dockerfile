# STORM API
# node:20-slim (Debian-based) required — IBM DB2 ODBC CLI driver needs glibc
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates make python3 g++ \
    libxml2 libpam0g libnuma1 && \
    rm -rf /var/lib/apt/lists/*

# Pre-download IBM DB2 CLI driver so ibm_db postinstall can find it locally
RUN curl -L --retry 5 --retry-delay 2 -o /tmp/linuxx64_odbc_cli.tar.gz \
    "https://public.dhe.ibm.com/ibmdl/export/pub/software/data/db2/drivers/odbc_cli/v12.1.0/linuxx64_odbc_cli.tar.gz"

WORKDIR /app

ARG NODE_AUTH_TOKEN

COPY .npmrc ./
COPY package*.json ./

RUN IBM_DB_INSTALLER_URL=/tmp/linuxx64_odbc_cli.tar.gz \
    NODE_AUTH_TOKEN=${NODE_AUTH_TOKEN} \
    npm ci --only=production && npm cache clean --force

COPY src/ ./src/

RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh nodejs

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3200

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3200/health || exit 1

CMD ["node", "src/index.mjs"]
