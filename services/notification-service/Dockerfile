# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    --network=host \
    npm ci --omit=dev
COPY src ./src
EXPOSE 4005
CMD ["node", "src/index.js"]
