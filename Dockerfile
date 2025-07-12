# Use official n8n image with all dependencies pre-installed
FROM n8nio/n8n:1.101.2

# Only configure necessary permissions
RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node/.n8n

# Install ONLY additional dependencies (Supabase client)
USER node
RUN mkdir -p /home/node/node_modules && \
    npm install --prefix /home/node @supabase/supabase-js

# Environment variables
ENV NODE_PATH=/home/node/node_modules
ENV N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s CMD node -e "require('axios').get('http://localhost:5678/healthz').catch(()=>process.exit(1))"

CMD ["n8n", "start"]
