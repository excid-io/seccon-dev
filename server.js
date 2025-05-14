// Const variables (with libraries required)
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const cookieParser = require("cookie-parser");
require('dotenv').config();

// Initialization
const app = express();

const HTTP_PORT = 9090;

//const vars
const httpServer = http.createServer(app);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

//Print type of request and url in every request
app.use((request, response, next) => {
    console.log(request.method, request.url);
    next();
});

// Index api is here, don't make route for it
app.get('/', (req, res) => {
    res.send("Hello world\n");
});

// Spin the server
httpServer.listen(HTTP_PORT, () => {
    console.log("HTTP server listening on http://localhost:9090");
});
