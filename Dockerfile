# Stage 1 - Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++

# Explicitly set package manager before corepack
RUN npm install -g npm@10.8.2
RUN corepack enable
RUN corepack prepare npm@10.8.2 --activate

# Install n8n globally
RUN npm install -g n8n@1.101.2 @supabase/supabase-js

# Stage 2 - Runtime
FROM node:20-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# Copy installed packages
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules

# Create symlinks
RUN ln -s /usr/local/lib/node_modules/n8n/bin/n8n /usr/local/bin/n8n

# Setup environment
RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node

USER node
ENV N8N_CONFIG_FILES=/home/node/.n8n/config
ENV NODE_ENV=production
ENV N8N_DISABLE_SQLITE=true

EXPOSE 5678
CMD ["n8n", "start"]
