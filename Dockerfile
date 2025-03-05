FROM node

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV HTTP_PORT=8080
ENV HTTPS_PORT=8443

EXPOSE 8080
EXPOSE 8443

CMD [ "node", "server.js" ]