# ===== Frontend build =====
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ARG VITE_REAL_API=true
ARG VITE_API_URL=/api
ARG VITE_APP_ENV=production
ARG VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51S5vcT2NIwvCc2GNfWFLPAmvbWZC8CVtVrYpS8axlefyR7hPvhgeo06URriAWj84moICUFYa6skWTLhuclDbFdE1005fsEE1IQ
ENV VITE_REAL_API=$VITE_REAL_API
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
RUN npm run build

# ===== Server build =====
FROM node:22-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --ignore-scripts
COPY server/ .
RUN npm run build

# ===== Runtime =====
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=server-build /app/server/dist ./dist
COPY --from=frontend-build /app/dist /app/dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
