# Production image for a Server-side Swift app.
FROM swift:6.0-noble AS build
WORKDIR /app

# Cache-friendly: resolve dependencies before copying full source.
COPY Package.swift Package.resolved* ./
RUN swift package resolve

COPY . .
RUN swift build -c release --static-swift-stdlib

# Runtime uses a slimmer Debian base; the static Swift stdlib is baked in.
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libcurl4 tzdata \
    && rm -rf /var/lib/apt/lists/*
# The binary name comes from Package.swift executableTarget name.
# Adjust this line when the target is renamed.
COPY --from=build /app/.build/release/app /usr/local/bin/app
USER 1000:1000
CMD ["app"]
