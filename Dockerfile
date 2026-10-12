FROM node:22-bookworm-slim AS base
WORKDIR /app
# Bootstrap HTTPS trust from the verified Node image, then install Debian's CA package.
RUN node -e "const fs=require('fs');fs.mkdirSync('/etc/ssl/certs',{recursive:true});fs.writeFileSync('/etc/ssl/certs/ca-certificates.crt',require('tls').rootCertificates.join('\\n')+'\\n')"
# An optional trusted CA bundle supports verified builds behind a corporate proxy.
RUN --mount=type=secret,id=build_ca,mode=0444 \
    sed -i "s|http://deb.debian.org|https://deb.debian.org|g" /etc/apt/sources.list.d/debian.sources && \
    if [ -s /run/secrets/build_ca ]; then \
      https_proxy="$HTTPS_PROXY" apt-get -o Acquire::https::CaInfo=/run/secrets/build_ca update && \
      https_proxy="$HTTPS_PROXY" apt-get -o Acquire::https::CaInfo=/run/secrets/build_ca install -y --no-install-recommends openssl ca-certificates; \
    else \
      apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates; \
    fi && rm -rf /var/lib/apt/lists/*
FROM base AS build
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN --mount=type=secret,id=build_ca,mode=0444 \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi && npm ci
COPY . .
RUN --mount=type=secret,id=build_ca,mode=0444 \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi && \
    npm run build && npm prune --omit=dev --ignore-scripts
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "scripts/deploy-start.mjs"]
