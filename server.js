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
const certificate = fs.readFileSync('security/FAIRDICE.crt', 'utf8');
const privateKey = fs.readFileSync('security/FAIRDICE.key', 'utf8');
const credentials = { key: privateKey, cert: certificate };

//const vars
const HTTP_PORT = process.env.HTTP_PORT;
const HTTPS_PORT = process.env.HTTPS_PORT;
const DOMAIN = process.env.DOMAIN
const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

// Redirect HTTP to HTTPS
app.use(function (req, res, next) {
    if (!req.secure) {
        return res.redirect("https://" + DOMAIN + ":" + HTTPS_PORT + req.originalUrl);
    }
    next();
});

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, './public')));
app.use(express.json());

//Print type of request and url in every request
app.use((request, response, next) => {
    console.log(request.method, request.url);
    next();
});


// Game route
const game_route = require('./routes/play_game.js');
app.use('/play', game_route);

// Authentication route
const auth_route = require('./routes/auth.js');
app.use('/auth', auth_route);

// Index api is here, don't make route for it
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});

// Spin the server
httpServer.listen(HTTP_PORT, () => {
    console.log("HTTP server listening on http://" + DOMAIN + ":" + HTTP_PORT)
});

httpsServer.listen(HTTPS_PORT, () => {
    console.log("HTTPS server listening on https://" + DOMAIN + ":" + HTTPS_PORT)
});
