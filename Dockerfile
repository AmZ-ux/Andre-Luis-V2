# Build
FROM node:22-alpine AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --ignore-scripts
COPY server/ .
RUN npm run build

# Runtime
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/server/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
