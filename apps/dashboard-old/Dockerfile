# Use the official Bun image
FROM oven/bun:1.1

# Install dependencies for Puppeteer and Chrome/Chromium
RUN apt-get update && \
    apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    chromium \
    gnupg \
    --no-install-recommends && \
    # Install Google Chrome stable
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Set Puppeteer executable path (prefer google-chrome-stable, fallback to chromium)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard

# Install dependencies
RUN bun install

# Declare build arguments for all environment variables
# Firebase client config (needed at build time for vite.define)
ARG PUBLIC_FIREBASE_WEB_API_KEY
ARG PUBLIC_FIREBASE_AUTH_DOMAIN
ARG PUBLIC_FIREBASE_PROJECT_ID
ARG PUBLIC_FIREBASE_STORAGE_BUCKET
ARG PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG PUBLIC_FIREBASE_APP_ID

# Firebase server config (needed at runtime)
ARG FIREBASE_PRIVATE_KEY_ID
ARG FIREBASE_PRIVATE_KEY
ARG FIREBASE_CLIENT_EMAIL
ARG FIREBASE_CLIENT_ID
ARG FIREBASE_AUTH_URL
ARG FIREBASE_TOKEN_URL
ARG FIREBASE_AUTH_CERT_URL
ARG FIREBASE_CLIENT_CERT_URL

# API and Base URLs
ARG API_BASE_URL

# Calendar
ARG CALENDAR_API_KEY
ARG EVENT_CALENDAR_ID

# Email configuration
ARG FROM_EMAIL
ARG REPLY_TO_EMAIL
ARG RESEND_API_KEY

# OpenRouter configuration
ARG OPENROUTER_API_KEY

# MXRoute email configuration
ARG MXROUTE_EMAIL_DOMAIN
ARG MXROUTE_EMAIL_OUTBOUND_LIMIT
ARG MXROUTE_EMAIL_QUOTA
ARG MXROUTE_LOGIN_KEY
ARG MXROUTE_SERVER_LOGIN
ARG MXROUTE_SERVER_URL

# Set environment variables for build and runtime
# Firebase client config
ENV PUBLIC_FIREBASE_WEB_API_KEY=$PUBLIC_FIREBASE_WEB_API_KEY
ENV PUBLIC_FIREBASE_AUTH_DOMAIN=$PUBLIC_FIREBASE_AUTH_DOMAIN
ENV PUBLIC_FIREBASE_PROJECT_ID=$PUBLIC_FIREBASE_PROJECT_ID
ENV PUBLIC_FIREBASE_STORAGE_BUCKET=$PUBLIC_FIREBASE_STORAGE_BUCKET
ENV PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV PUBLIC_FIREBASE_APP_ID=$PUBLIC_FIREBASE_APP_ID

# Firebase server config
ENV FIREBASE_PRIVATE_KEY_ID=$FIREBASE_PRIVATE_KEY_ID
ENV FIREBASE_PRIVATE_KEY=$FIREBASE_PRIVATE_KEY
ENV FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL
ENV FIREBASE_CLIENT_ID=$FIREBASE_CLIENT_ID
ENV FIREBASE_AUTH_URL=$FIREBASE_AUTH_URL
ENV FIREBASE_TOKEN_URL=$FIREBASE_TOKEN_URL
ENV FIREBASE_AUTH_CERT_URL=$FIREBASE_AUTH_CERT_URL
ENV FIREBASE_CLIENT_CERT_URL=$FIREBASE_CLIENT_CERT_URL

# API and Base URLs
ENV API_BASE_URL=$API_BASE_URL

# Calendar
ENV CALENDAR_API_KEY=$CALENDAR_API_KEY
ENV EVENT_CALENDAR_ID=$EVENT_CALENDAR_ID

# Email configuration
ENV FROM_EMAIL=$FROM_EMAIL
ENV REPLY_TO_EMAIL=$REPLY_TO_EMAIL
ENV RESEND_API_KEY=$RESEND_API_KEY

# OpenRouter configuration
ENV OPENROUTER_API_KEY=$OPENROUTER_API_KEY

# MXRoute email configuration
ENV MXROUTE_EMAIL_DOMAIN=$MXROUTE_EMAIL_DOMAIN
ENV MXROUTE_EMAIL_OUTBOUND_LIMIT=$MXROUTE_EMAIL_OUTBOUND_LIMIT
ENV MXROUTE_EMAIL_QUOTA=$MXROUTE_EMAIL_QUOTA
ENV MXROUTE_LOGIN_KEY=$MXROUTE_LOGIN_KEY
ENV MXROUTE_SERVER_LOGIN=$MXROUTE_SERVER_LOGIN
ENV MXROUTE_SERVER_URL=$MXROUTE_SERVER_URL

# Build the application
WORKDIR /app/apps/dashboard
RUN bun run build

# Expose the port your app runs on
EXPOSE 4321

# Start the server
CMD ["bun", "run", "start"]
