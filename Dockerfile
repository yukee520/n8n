FROM n8nio/n8n:latest

# Install Supabase client
RUN npm install @supabase/supabase-js

# Pre-configure API integration
COPY supabase /home/node/.n8n/custom/

CMD ["n8n", "start"]
