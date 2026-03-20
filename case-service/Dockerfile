FROM node:24-alpine

# Accept build argument for npm_token
ARG NPM_TOKEN

WORKDIR /usr/src/app

COPY package*.json ./

RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    make \
    python3 \
    g++ \
    build-base

# Create .npmrc file with authentication
RUN if [ -n "$NPM_TOKEN" ]; then \
    echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" > .npmrc; \
    echo "@joinworth:registry=https://npm.pkg.github.com" >> .npmrc; \
    echo "always-auth=true" >> .npmrc; \
else \
    echo "Warning: No NPM_TOKEN provided, private packages may fail to install"; \
fi

RUN npm ci --ignore-scripts --no-audit --no-fund

# Rebuild native modules that require compilation
RUN npm rebuild @confluentinc/kafka-javascript || npm rebuild

COPY . .

EXPOSE 3001

CMD [ "npm", "run", "start:prod" ]
