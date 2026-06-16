FROM mcr.microsoft.com/playwright:v1.51.0-jammy

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV PLAYWRIGHT_HEADLESS=true
ENV DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 3001
CMD ["npm", "start"]
