# Multi-stage build for the NestJS API + worker (same image, two entrypoints).
# Finalized in the Docker milestone; builds once apps/api is implemented.

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci
COPY . .
RUN npm run shared:build && npm run build --workspace @ideascout/api

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
