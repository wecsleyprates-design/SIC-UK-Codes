FROM node:22-slim

# Accept build argument for npm_token
ARG NPM_TOKEN

WORKDIR /usr/src/app

COPY package*.json ./

RUN apt-get update && apt-get install -y \
    make \
    python3 \
    g++ \
    build-essential \
    imagemagick \
    graphicsmagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Create .npmrc file with authentication
RUN if [ -n "$NPM_TOKEN" ]; then \
    echo "NPM_TOKEN is set"; \
    echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" > .npmrc; \
    echo "@joinworth:registry=https://npm.pkg.github.com" >> .npmrc; \
    echo "always-auth=true" >> .npmrc; \
else \
    echo "Warning: No NPM_TOKEN provided, private packages may fail to install"; \
fi

RUN npm ci --ignore-scripts --no-audit --no-fund

# Rebuild native modules that require compilation
RUN npm rebuild @confluentinc/kafka-javascript || npm rebuild

RUN npx playwright install-deps

RUN npx playwright install chromium

COPY . .

# Adding a build step to add a dist directory to image so that
# We have a built directory with an entry pointfor ephemeral jobs
RUN npm run build:clean

EXPOSE 3001

CMD [ "npm", "run", "start:prod" ]