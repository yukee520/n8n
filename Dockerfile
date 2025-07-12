FROM n8nio/n8n:latest

# 1. Install dependencies as root
RUN npm install -g n8n @supabase/supabase-js

# 2. Create and fix permissions for n8n directory
RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node/.n8n

# 3. Set environment variables
ENV N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
ENV NODE_ENV=production

# 4. Switch to non-root user
USER node

# 5. Health check
HEALTHCHECK --interval=30s CMD node -e "require('axios').get('http://localhost:5678/healthz').catch(()=>process.exit(1))"

CMD ["n8n", "start"]
