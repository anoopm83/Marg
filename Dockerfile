# Marg — single-service image: Express serves the built SPA + the /api backend.
# Build:  docker build -t marg .
# Run:    docker run -p 5175:5175 --env-file api/.env marg

# ---- stage 1: build the React front-end ----
FROM node:24-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- stage 2: runtime (api serves /api and the built front-end) ----
FROM node:24-slim AS run
WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci
COPY api/ ./
# Data lives at the project root and under api/personas (loaded relative to /app).
COPY marg-dataset-v0.json /app/marg-dataset-v0.json
COPY --from=web /app/web/dist /app/web/dist
ENV NODE_ENV=production
ENV WEB_DIST=/app/web/dist
ENV PORT=5175
EXPOSE 5175
CMD ["npm", "start"]
