require('dotenv').config();
const database = require('mysql2');

// Initialize connection to our database GDPR in Mysql via Nodejs
var mysqlconn = database.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

module.exports = mysqlconn;