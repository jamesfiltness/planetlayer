FROM node:24-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY shared ../shared
COPY client .
ARG VITE_TILES
RUN npm run build

FROM node:24-alpine
RUN apk add --no-cache gdal-tools
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY shared ../shared
COPY server .
COPY --from=client /app/client/dist ../client/dist
EXPOSE 8080
CMD ["node", "index.js"]
