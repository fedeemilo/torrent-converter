# --- Build stage ---
# Instala dependencias con herramientas de compilación (necesarias para
# los módulos nativos de webtorrent en ARM)
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# --- Production stage ---
# Imagen final sin herramientas de build → más liviana
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY server.js .
COPY public/ ./public/

EXPOSE 3014

CMD ["node", "server.js"]
