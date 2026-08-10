FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN chmod +x entrypoint.sh && chown -R node:node /app

USER node

ENTRYPOINT ["./entrypoint.sh"]
