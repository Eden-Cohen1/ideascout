# Multi-stage build for the NestJS API + worker (same image, two entrypoints).
# The `build` stage (with devDeps, Prisma CLI, schema + migrations) also serves as
# the one-shot `migrate` service image in docker-compose.

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci
COPY . .
# Generate the Prisma client (into node_modules/.prisma) before compiling.
RUN npm run shared:build \
  && npx prisma generate --schema=apps/api/prisma/schema.prisma \
  && npm run build --workspace @ideascout/api

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev
# Bring over compiled output + the generated Prisma client (query engine + types).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
