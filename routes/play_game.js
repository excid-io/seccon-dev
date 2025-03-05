const { Router } = require('express');
const path = require('path');
const { sha3hash } = require('../helper.js');
const { generateRandomSecret, checkJWTForPlay } = require('../helper.js');
const { createHash } = require('crypto');
const mysqlconn = require('../database/db.js');
const moment = require('moment');

const router = Router();

const DICE_MAX = 6;
const DICE_MIN = 1;
var binding_secret;
var opponent_binding_secret;
var roll_output;
var opponent_hash;
var opponent_roll;
const send_back_secret = { secret: binding_secret, msg: "Created secret" };
const invalid_length_client_secret = { msg: "Invalid secret sent, length does not match" }

// Internal functions
function rollDice() {
    return Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1) + DICE_MIN);
}

function sha256(message) {
    return createHash('sha256').update(message).digest('hex');
}

/**
 * Endpoints
 */
// Router has prefix /play, so this endpoint is /play/
router.get('/', checkJWTForPlay, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/play/game.html'));
});


/** Step 1 
 * Initiates a new game by created new secrets
 */
router.post('/newGame', checkJWTForPlay, (req, res) => {
    //1. store the binding secret of the client
    opponent_binding_secret = req.body.secret;
    console.log("Opponent secret: " + opponent_binding_secret);
    //2. the server generates a random secret
    binding_secret = generateRandomSecret();
    if (opponent_binding_secret.length != binding_secret.length) return res.json(invalid_length_client_secret);
    console.log("My secret: " + binding_secret);
    //3. the server sends the secret to the client
    send_back_secret.secret = binding_secret;
    return res.json(send_back_secret);
});

/** Step 2
 * Get the hash produced by the player
 */
router.post('/exchangeHashes', checkJWTForPlay, (req, res) => {
    //1. get the hash of the client
    opponent_hash = req.body.hash;
    console.log("Hash received: " + opponent_hash);
    //2. roll, save the roll output, and hash (roll_output + my_binding_secret + opponent_binding_secret)
    roll_output = rollDice();
    console.log("My roll: " + roll_output);
    hash_output = sha256(roll_output.toString() + opponent_binding_secret + binding_secret);
    console.log("Hash to send: " + hash_output);
    return res.json({ hash: hash_output });
});

/** Step 3
 * Gets the roll of the client and verifies it against the previously obtained hash
 */
router.post('/exchangeRolls', checkJWTForPlay, async (req, res) => {
    opponent_roll = req.body.roll;
    if (opponent_roll < DICE_MIN || opponent_roll > DICE_MAX) {
        return res.json({ msg: "Invalid number for roll" });
    }
    //IMPORTANT to verify: the order the client used to hash sha256(roll_output + opponent_binding_secret + binding_secret);
    //the "opponent_binding_secret" of the client is my secret (server's) and binding_secret the client's
    new_hash = sha256(opponent_roll + binding_secret + opponent_binding_secret);
    console.log("Hash produced by the client's roll: " + new_hash);
    if (new_hash == opponent_hash) {
        console.log("Hashes of client match");
        try {
            let id = await findUserId(req.user.username);
            let timestamp = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
            saveToMatchHistory(id, opponent_roll, roll_output, timestamp);  //save to history only if players where honest
            return res.json({ roll: roll_output, msg: "Hashes match check with my roll now" });
        } catch (err) {
            console.log(err);
            return res.json({ msg: "Could not find id of the user " + req.user.username });
        }
    } else {
        console.log("Hashes do NOT match");
        return res.json({ roll: roll_output, msg: "No cheating here bro" });
    }
});

function saveToMatchHistory(username, client_roll, server_roll, timestamp) {
    mysqlconn.query('INSERT INTO match_history(user_id, client_roll, server_roll, time) VALUES(?,?,?,?)',
        [username, client_roll, server_roll, timestamp], (err, result, fields) => {
            if (err) {
                console.log(err);
                return err;
            }
            console.log("Successfully saved match to database");
        });
}

function findUserId(username) {
    return new Promise((resolve, reject) => {
        mysqlconn.query('SELECT id FROM users WHERE username=?', [username], (err, result, fields) => {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(result[0].id);
            }
        });
    });
}

module.exports = router;