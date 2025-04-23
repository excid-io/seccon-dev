const crypto = require('crypto-js');
const crypto1 = require('crypto');
const jwt = require('jsonwebtoken');
const mysqlconn = require('./database/db.js')

// Pass sha3 encryption salted to user password via the following function
function SHA3hashPassword(secretpass, salt) {
    const concatPass = secretpass + salt;
    return crypto.SHA3(concatPass).toString(crypto.enc.Hex);
}

// Create a random salt as an extra measure to the password encryption
function generateRandomSecret(size = 32) {
    return crypto1
        .randomBytes(size)
        .toString('base64')
        .slice(0, size)
}

// Create Initialization Vector for AES-256 Encryption
function initializeVector() {
    return crypto1.randomBytes(16);
}

// Create the encryption key utilized for the AES
function createEncKey() {
    return crypto1.randomBytes(32);
}

// Encryption process for password with AES
function AESEncryptHashedPass(hashed_secret, skey, vector) {
    const cipheredData = crypto1.createCipheriv('aes-256-cbc', skey, vector);
    let encryptedData = cipheredData.update(hashed_secret, 'utf8', 'base64');
    encryptedData += cipheredData.final('base64');
    return encryptedData;
    //return crypto.AES.encrypt(hashed_secret, skey).toString(crypto.enc.Utf8);
}

// Decryption Process for password
function AESDecryptHashedPass(encPass, skey, vector) {
    const decipheredData = crypto1.createDecipheriv('aes-256-cbc', skey, vector);
    let decryptedData = decipheredData.update(encPass, 'base64', 'utf8');
    decryptedData += decipheredData.final('utf8');
    return decryptedData;
}

//
function checkJWTForPlay(req, res, next) {
    const token = req.cookies.token;
    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        req.user = user;
        next();
    } catch (err) {
        res.clearCookie("token");
        return res.redirect("/auth")
    }
}

function checkJWTExists(req, res, next) {
    const token = req.cookies.token;
    if (token != undefined) {
        return res.redirect("/play");
    }
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        return res.redirect("/play");
    } catch (err) {
        //console.log(err);
        next();
    }
}

module.exports = {
    SHA3hashPassword,
    generateRandomSecret,
    AESEncryptHashedPass,
    AESDecryptHashedPass,
    checkJWTForPlay,
    checkJWTExists,
    initializeVector,
    createEncKey
};