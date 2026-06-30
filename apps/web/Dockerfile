# Multi-stage build for the Vue SPA -> static serve via nginx.
# Finalized in the Docker milestone; builds once apps/web is implemented.

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run shared:build && npm run build --workspace @ideascout/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
