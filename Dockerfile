FROM node:22-bookworm-slim AS base
WORKDIR /app
# Bootstrap HTTPS trust from the verified Node image, then install Debian's CA package.
RUN node -e "const fs=require('fs');fs.mkdirSync('/etc/ssl/certs',{recursive:true});fs.writeFileSync('/etc/ssl/certs/ca-certificates.crt',require('tls').rootCertificates.join('\\n')+'\\n')"
RUN sed -i "s|http://deb.debian.org|https://deb.debian.org|g" /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
FROM base AS build
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "scripts/deploy-start.mjs"]
