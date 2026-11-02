FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY overlay/package.json overlay/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/overlay/dist ./overlay/dist
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
