FROM node:20-alpine
RUN npm install -g n8n
EXPOSE 5678
CMD ["n8n", "start"]
