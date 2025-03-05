require('dotenv').config();

const { Router } = require('express');
const path = require('path');
const mysqlconn = require('../database/db.js');
const { SHA3hashPassword, generateRandomSecret, checkJWTExists, AESEncryptHashedPass, AESDecryptHashedPass, initializeVector, createEncKey } = require('../helper.js');
const inputValidate = require('validator');
const jwt = require('jsonwebtoken');

const router = Router();
//const pass_key = process.env.PASSWORD_KEY;
//const salt_key = process.env.SALT_KEY;
const specialChars = /[`!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?~ ]/;

//Replies for authentication attempts
const login_true_response = { auth: true, msg: "Logged in" };
const login_false_response = { auth: false, msg: "Username or password invalid" };
const enc_false_response = { auth: false, msg: "Bad Encrypt" };
const register_true_response = { auth: true, msg: "Registered" };
const register_false_response = { auth: false, msg: "Username taken" };
const register_confirm_pword_invalid = { auth: false, msg: "Passwords do not match" };
const invalid_uname_format = { auth: false, msg: "Invalid username format" };
const bad_characters = { auth: false, msg: "Username cannot contain symbols like '-' or single quote or double quote" };
const bad_fname = { auth: false, msg: "First name cannot contain symbols like '-' or single quote or double quote" };
const bad_lname = { auth: false, msg: "Last name cannot contain symbols like '-' or single quote or double quote" };
const bad_password_length = { auth: false, msg: "Password length must be at least 8 and no more than 20 characters" };
const empty_fields = { auth: false, msg: "Fields must not be empty" };
const logout_successful = { logout: true, msg: "Logged out successfully" };
const logout_failed = { logout: true, msg: "Log out failed" };
const blocked_user = { auth: false, msg: "This user has been blocked. Please contact our support department for further assistance" };
const register_no_match_policy = { logout: true, msg: "Password does not match the policy" };


//Endpoints

/**
 * Get the login and register page
 */
router.get('/', checkJWTExists, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/auth/login_register.html'));
});

// Mapping utilized for storing failed login attempts (lock the user in case of a brute force attack)
const failedlogins = new Map();

// Set utilized for storing blocked users (in case of a brute force attack)
const blockList = new Set();

/**
 * Authenticate user login
 */
router.post('/login', checkJWTExists, (req, res) => {
    //0. get the credentials from the post request
    const { username, password } = req.body;
    console.log("Attempting login with credentials: " + username + " " + password);

    //check for empty fields
    if (username.trim() == "" || password.trim() == "") {
        return res.json(empty_fields);
    }

    // Extra measures to further prevent SQL Injection Attempts like user input sanitization
    if (!inputValidate.isAlphanumeric(username)) {
        return res.json(invalid_uname_format);
    }

    // Measures taken against potential brute force attacks, check whether the current user has been blocked
    if (blockList.has(username)) {
        console.log("The login process has been disabled for user: " + username);
        return res.json(blocked_user);
    }

    // Check if the maximum login attempts have been reached
    if (failedlogins.has(username) && failedlogins.get(username) >= 3) {
        console.log("The blocking process has begun for the user: " + username);
        blockList.add(username);
        return res.json(blocked_user);
    }

    //1. get user from database, with the use of PreparedStatement as a measure against SQL Injection
    mysqlconn.query(`SELECT id, password FROM users WHERE username=?`, [username], function (err, result, fields) {
        if (err) {
            console.error("There was an error in fetching the user from the database:", err);
            return res.json({ msg: "Error in fetching user from database!!!" });
        }
        // console.log(result);
        //if no records where returned, the given username does not exist
        if (result.length == 0) {
            //failedlogins.set(username, (failedlogins.get(username) || 0) + 1);
            res.json(login_false_response);
            return;
        }

        //2. Retrieve the id, password from the database for the aforesaid user
        const fid = result[0].id;
        const stored_enc_pass_hash = result[0].password;

        mysqlconn.query(`SELECT salt, vector, skey FROM sec_details WHERE user_id=?`, [fid], function (err, result, fields) {
            if (err) {
                console.error("There was an error in fetching the details from the database:", err);
                return res.json({ msg: "Error in fetching details from database!!!" });
            }

            //2. Retrieve the according key, vector and salt from the database for the aforesaid user
            const salted = result[0].salt;
            const vector = result[0].vector;
            const ekey = result[0].skey;

            // 3a. hash & encrypt the password given as user input with the encryption key and vector
            const hashed_password = SHA3hashPassword(password, salted);
            const enc_hash_pass = AESEncryptHashedPass(hashed_password, ekey, vector);

            //3b. check if (1.)encrypted password == (2.)password given by the user
            if (enc_hash_pass == stored_enc_pass_hash) {
                console.log("logging in");
                //res.json(login_true_response);
                //4. generate jwt token
//                 const token = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.
// eyJjbGllbnRfaWQiOiJZekV6TUdkb01ISm5PSEJpT0cxaWJEaHlOVEE9IiwicmVzcG9uc2Vf
// dHlwZSI6ImNvZGUiLCJzY29wZSI6ImludHJvc2NwZWN0X3Rva2VucywgcmV2b2tlX3Rva2Vu
// cyIsImlzcyI6ImJqaElSak0xY1hwYWEyMXpkV3RJU25wNmVqbE1iazQ0YlRsTlpqazNkWEU9
// Iiwic3ViIjoiWXpFek1HZG9NSEpuT0hCaU9HMWliRGh5TlRBPSIsImF1ZCI6Imh0dHBzOi8v
// bG9jYWxob3N0Ojg0NDMve3RpZH0ve2FpZH0vb2F1dGgyL2F1dGhvcml6ZSIsImp0aSI6IjE1
// MTYyMzkwMjIiLCJleHAiOiIyMDIxLTA1LTE3VDA3OjA5OjQ4LjAwMCswNTQ1In0.
// IxvaN4ER-PlPgLYzfRhk_JiY4VAow3GNjaK5rYCINFsEPa7VaYnRsaCmQVq8CTgddihEPPXe
// t2laH8_c3WqxY4AeZO5eljwSCobCHzxYdOoFKbpNXIm7dqHg_5xpQz-YBJMiDM1ILOEsER8A
// DyF4NC2sN0K_0t6xZLSAQIRrHvpGOrtYr5E-SllTWHWPmqCkX2BUZxoYNK2FWgQZpuUOD55H
// fsvFXNVQa_5TFRDibi9LsT7Sd_az0iGB0TfAb0v3ZR0qnmgyp5pTeIeU5UqhtbgU9RnUCVmG
// IK-SZYNvrlXgv9hiKAZGhLgeI8hO40utfT2YTYHgD2Aiufqo3RIbJA
// `;
                const token = jwt.sign({ username: username, password: enc_hash_pass }, 'pTNFpY%W{?T!E}[$-=xJ', { expiresIn: "1h" });
                res.cookie("token", token, {
                    httpOnly: true, // Cookies are accessible only through http(s)
                    secure: true, // Only sent over https
                    // maxAge: 1000000,
                    // signed: true
                });
                res.json(login_true_response);
            } else {
                failedlogins.set(username, (failedlogins.get(username) || 0) + 1);
                console.log("failed to log in");
                return res.json(login_false_response);
            }
        });
    });
});

/**
 * Register user / Create new user in db
 */
router.post('/register', checkJWTExists, (req, res) => {
    //0. get the credentials from the post request
    const { first_name, last_name, username, password, password2 } = req.body;
    if (password != password2) {
        return res.json(register_confirm_pword_invalid);
    }
    const salty = generateRandomSecret();
    // const enc_salty = AESEncryptHashedPass(salty, salt_key);

    // Initialized Vector AES
    const vector = initializeVector();

    // Encryption Key for AES
    const skey = createEncKey();

    //check for empty fields
    if (first_name.trim() == "" || last_name.trim() == "" || username.trim() == "" || password.trim() == "") {
        return res.json(empty_fields);
    }

    // Extra measures to further prevent SQL Injection Attempts like user input sanitization
    if (!inputValidate.isAlphanumeric(first_name)) {
        return res.json(bad_fname);
    }

    // Extra measures to further prevent SQL Injection Attempts like user input sanitization
    if (!inputValidate.isAlphanumeric(last_name)) {
        return res.json(bad_lname);
    }

    // Extra measures to further prevent SQL Injection Attempts like user input sanitization
    if (!inputValidate.isAlphanumeric(username)) {
        return res.json(bad_characters);
    }


    // Check password validity according to the policy. If doesnt match, inform user
    // 1,2 check for length, 3 check for special characters, 4 check if contains number
    if (password.length < 8 || password.length > 20 || !specialChars.test(password) || !/\d/.test(password) || !/[a-zA-Z]/g.test(password)) {
        return res.json(register_no_match_policy);
    }

    //1. check if user already in db, if exists, throw error (Prepared Statements)
    mysqlconn.query(`SELECT * FROM users WHERE username=?`, [username], function (err, result, fields) {
        if (err) throw err;
        //if the result array has one (or more?) elements, the username exists
        if (result.length > 0) {
            return res.json(register_false_response);
        } else {
            //2. if not exists, insert user into db
            //2.a. hash and encrypt the password
            const hashed_password = SHA3hashPassword(password, salty);
            const enc_hashed_password = AESEncryptHashedPass(hashed_password, skey, vector);
            //2.b. store the password with the use of Prepared Statement as a measure against SQL Injection
            mysqlconn.query(`INSERT INTO users (firstname, lastname, username, password) 
                    VALUES(?, ?, ?, ?)`, [first_name, last_name, username, enc_hashed_password], (err, result, fields) => {

                if (err) {
                    console.error("There was an error in registering user:", err);
                    return res.json(register_false_response);
                }
                else {

                    // console.log(result);
                    //if no records where returned, the given username does not exist
                    if (result.length == 0) {
                        res.json(login_false_response);
                        return;
                    }

                    mysqlconn.query(`SELECT id FROM users WHERE username=?`, [username], function (err, result, fields) {
                        if (err) {
                            throw err;
                        }
                        else {

                            const id = result[0].id;
                            //2.b. store the password with the use of Prepared Statement as a measure against SQL Injection
                            mysqlconn.query(`INSERT INTO sec_details (user_id, vector, salt, skey) 
                            VALUES(?, ?, ?, ?)`, [id, vector, salty, skey], (err, result, fields) => {

                                if (err) {
                                    console.error("!!!Bad Encryption!!!", err);
                                    return res.json(enc_false_response);
                                }
                                console.log("Success!!!");
                                res.setHeader('Clear-Site-Data', '"cookies"');
                                return res.json(register_true_response);

                            });
                        }
                    });
                }
            });
        }
    });
});

/**
 * Logout the user
 */
router.post('/logout', (req, res) => {
    const token = req.cookies.token;
    //if no token is sent, redirect to auth page
    if (token == undefined) {
        return res.json(logout_failed);
    }
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        mysqlconn.query(`SELECT token FROM jwt_blacklist WHERE token=?`, [token], (err, result, fields) => {
            if (err) throw err;
            //if no results where returned, this jwt is not blacklisted, so, blacklist it and logout the user
            if (result.length == 0) {
                //save the jwt
                mysqlconn.query(`INSERT INTO jwt_blacklist(token) VALUES(?)`, [token], (err, result, fields) => {
                    if (err) throw err;
                    res.clearCookie("token");
                    res.json(logout_successful);
                });

            } else {
                res.clearCookie("token");
                res.setHeader('Clear-Site-Data', '"cookies"');
                return res.json(logout_successful);
            }
        });
    } catch (err) {
        console.log(err);
        return res.json(logout_failed);
    }
});

module.exports = router;