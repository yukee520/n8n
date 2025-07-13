FROM n8nio/n8n:1.101.2

# Force PostgreSQL connection
ENV N8N_DB_TYPE=postgresdb
ENV N8N_DB_POSTGRESDB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
ENV N8N_DB_POSTGRESDB_USER=postgres.bbhgccqzpkjkfrtzoxpz
ENV N8N_DB_POSTGRESDB_PASSWORD="5201314-Yukee"
ENV N8N_DB_POSTGRESDB_DATABASE=postgres
ENV N8N_DB_POSTGRESDB_PORT=5432
ENV N8N_DB_POSTGRESDB_SSL=true
ENV N8N_DB_POSTGRESDB_SSLMODE=require
ENV N8N_DB_SKIP_MIGRATION=false

# Disable tunnel (causing issues)
ENV N8N_DISABLE_TUNNEL=true

# Proper logging level
ENV N8N_LOG_LEVEL=debug

# Task runner config
ENV N8N_RUNNER_JWT_SECRET=your_random_secret_here
ENV N8N_RUNNER_PORT=5679

CMD ["n8n", "start"]
