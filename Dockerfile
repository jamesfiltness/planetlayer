# Pinned by digest (like the database image in docker-compose.yml), so a
# rebuild can't pull in different code. The Alpine release under this image
# also decides the GDAL version, which must be 3.11 or later.
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS base

FROM base AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY shared ../shared
COPY client .
RUN npm run build

FROM base
RUN apk add --no-cache gdal-tools
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY shared ../shared
COPY server .
COPY --from=client /app/client/dist ../client/dist
# GDAL reads files anyone could have made, so the app doesn't run as root.
# The code stays owned by root, so the app can't change it either; uploads
# go to /tmp, which every user can write to.
USER node
EXPOSE 8080
CMD ["node", "index.js"]
