FROM node

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY server.js .

ENV HTTP_PORT=8080

EXPOSE 9090

CMD [ "node", "server.js" ]