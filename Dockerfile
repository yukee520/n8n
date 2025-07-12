# Stage 1 - Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++

# Explicitly set package manager
RUN corepack enable pnpm
RUN npm install -g n8n@1.101.2 @supabase/supabase-js

# Stage 2 - Runtime
FROM node:20-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# Copy installed packages
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules

# Create necessary symlinks
RUN ln -s /usr/local/lib/node_modules/n8n/bin/n8n /usr/local/bin/n8n && \
    ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

# Setup environment
RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node

USER node
ENV N8N_CONFIG_FILES=/home/node/.n8n/config
ENV NODE_ENV=production
ENV N8N_DISABLE_SQLITE=true

EXPOSE 5678
CMD ["n8n", "start"]
