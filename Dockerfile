FROM node:24-alpine AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client .
ARG VITE_TILES
RUN npm run build

FROM node:24-alpine
RUN apk add --no-cache gdal-tools
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server .
COPY --from=client /client/dist /app/client/dist
EXPOSE 8080
CMD ["node", "index.js"]
