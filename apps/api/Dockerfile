FROM node:22-alpine

WORKDIR /app

# Install system dependencies (python for yt-dlp-exec, yt-dlp for audio downloads)
RUN apk add --no-cache python3 yt-dlp

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
