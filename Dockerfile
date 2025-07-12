FROM n8nio/n8n:latest

# Fix permissions and install dependencies
RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node/.n8n && \
    npm install -g n8n @supabase/supabase-js

# Set mandatory variables
ENV N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
ENV NODE_ENV=production

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=30s CMD node -e "require('axios').get('http://localhost:5678/healthz').catch(()=>process.exit(1))"

CMD ["n8n", "start"]
