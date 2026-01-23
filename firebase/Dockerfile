FROM node:20-alpine

# Install Java runtime required by Firebase emulators
RUN apk add --no-cache openjdk21-jre

# Install Firebase CLI globally
RUN npm install -g firebase-tools

# Default working directory matches docker-compose volume mount
WORKDIR /firebase

# Default command executes firebase emulators (overridden by docker-compose if needed)
CMD ["firebase", "emulators:start"]
