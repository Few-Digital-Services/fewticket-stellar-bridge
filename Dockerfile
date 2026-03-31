# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g pm2 && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 5000
CMD ["pm2-runtime", "dist/main.js", "--name", "fewticket-stellar"]
