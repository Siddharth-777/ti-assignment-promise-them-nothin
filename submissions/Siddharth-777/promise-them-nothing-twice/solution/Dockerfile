FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN chown -R node:node /app

USER node

CMD ["node", "src/server.js"]
