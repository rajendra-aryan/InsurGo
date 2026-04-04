FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./

RUN npm ci

COPY . /app

EXPOSE 5000

CMD ["npm", "start"]