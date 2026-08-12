FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

EXPOSE 4000
# CMD ["node", "dist/main"]
CMD ["sh", "-c", "if [ -f dist/main.js ]; then exec node dist/main.js; else exec node dist/src/main.js; fi"]
