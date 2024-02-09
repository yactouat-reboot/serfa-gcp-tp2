FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /home/pptruser/app

COPY --chown=pptruser:pptruser package*.json ./

# cette partie est responsable de l'installation des dépendances
RUN npm ci

COPY --chown=pptruser:pptruser . .

ENV GOOGLE_APPLICATION_CREDENTIALS="/secrets/web-screenshots-app-sa.json"

USER pptruser

# docker run MON_IMAGE URL
ENTRYPOINT [ "npm", "run", "start"] 