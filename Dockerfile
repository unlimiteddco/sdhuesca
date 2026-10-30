# Compila el sitio estático de un club con Astro y lo sirve con nginx (puerto 80).
# El club se elige al construir: --build-arg CLUB=madrid (en Dokploy, «Build Args»). Por defecto, huesca.
FROM node:22-slim AS build
ARG CLUB=huesca
ENV CLUB=$CLUB
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
