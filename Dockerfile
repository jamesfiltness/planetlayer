FROM node:24-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY shared ../shared
COPY client .
ARG VITE_TILES
RUN npm run build

# Compiles the server, and runs its tests (`docker compose run --rm test`),
# so it has GDAL and the dev dependencies.
FROM node:24-alpine AS server
RUN apk add --no-cache gdal-tools
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY shared ../shared
COPY server .
RUN npm run build

FROM node:24-alpine
RUN apk add --no-cache gdal-tools
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY shared ../shared
COPY --from=server /app/server/dist dist
COPY --from=client /app/client/dist ../client/dist
EXPOSE 8080
CMD ["node", "dist/main.js"]
