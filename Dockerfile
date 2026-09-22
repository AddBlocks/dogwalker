FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY backend/package.json backend/package-lock.json ./backend/

RUN npm ci --prefix frontend --include=dev \
 && npm ci --prefix backend

COPY frontend ./frontend
COPY backend ./backend

RUN npm run build --prefix frontend

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "start", "--prefix", "backend"]
