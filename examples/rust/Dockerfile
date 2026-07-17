# Multi-stage build for a Cargo project. Uses cargo-chef to cache dep builds
# separately from source changes.
FROM rust:latest AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS build
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# The binary name comes from Cargo.toml [package].name — adjust after copying.
COPY --from=build /app/target/release/app /usr/local/bin/app
USER 1000:1000
CMD ["app"]
