FROM node:20-bullseye

# Install Java runtime required by Firebase emulators
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-17-jre-headless && \
    rm -rf /var/lib/apt/lists/*

# Install Firebase CLI globally
RUN npm install -g firebase-tools

# Default working directory matches docker-compose volume mount
WORKDIR /firebase

# Default command executes firebase emulators (overridden by docker-compose if needed)
CMD ["firebase", "emulators:start"]
