const DICE_MAX = 6;
const DICE_MIN = 1;

async function sha256(message) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

        return hashHex;
    } catch (error) {
        console.error(error);
        return null;
    }
}

function rollDice() {
    return Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1) + DICE_MIN);
}

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
function generateRandomSecret(length = 32) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}


const dice = document.getElementById('dice-btn');

function updateUI(my_roll, opponent_roll) {
    //Dice 1
    var diceLocation = "img/" + "Dice-" + my_roll + ".png";
    var img1 = document.querySelectorAll("img")[0];
    img1.setAttribute("src", diceLocation);

    //Dice2
    var diceLocation2 = "img/" + "Dice-" + opponent_roll + ".png";
    var img2 = document.querySelectorAll("img")[1];
    img2.setAttribute("src", diceLocation2);

    if (my_roll > opponent_roll) {
        document.querySelector("h1").innerHTML = "🏅🎲 Player 1 Win!";
    }
    else if (my_roll < opponent_roll) {
        document.querySelector("h1").innerHTML = "Player 2 Win! 🏅🎲 ";
    }
    else if (my_roll = opponent_roll) {
        document.querySelector("h1").innerHTML = "🏅🎲 Match Draw! 🎲🏅";
    }
    else {
        document.querySelector("h1").innerHTML = "Something Error...";
    }

    //button text change
    dice.innerHTML = "Play Again!";
}

function logout() {
    fetch(window.location.origin + '/auth/logout', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
    })
        .then(resp => resp.json())
        .then(resp => {
            alert(resp.msg);
            if (resp.logout == true) {
                window.location.href = window.location.origin + "/auth"
            }
        })
        .catch(err => console.log(err));
}

var binding_secret;
var opponent_binding_secret;
var opponent_hash;
/**
 * Function that leverages the commitment scheme protocol for honest games between the client and the server
 */
async function play() {
    console.log("========= GAME START =========");
    //1. establish the secrets exchange with the server
    binding_secret = generateRandomSecret();
    const response_secret = await fetch(window.location.origin + '/play/newGame', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            secret: binding_secret
        })
    });
    try {
        let info = await response_secret.json();
        opponent_binding_secret = info.secret;
        console.log("Opponent secret: " + opponent_binding_secret);
        console.log("My secret: " + binding_secret);
    } catch (err) {
        console.log(err);
        return;
    }

    //2. roll the dice
    roll_output = rollDice();
    console.log("My roll: " + roll_output);
    //3. hash(roll_output, opponent_secret, my_secret)
    hash_output = await sha256(roll_output.toString() + opponent_binding_secret + binding_secret);
    console.log("Hash to send to the server: " + hash_output);
    //4. send the hash to the server, and get the hash from the server as well
    const hash_reply = await fetch(window.location.origin + '/play/exchangeHashes', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            hash: hash_output
        })
    });
    try {
        let info = await hash_reply.json();
        opponent_hash = info.hash;
        console.log("Server hash: " + opponent_hash);
    } catch (err) {
        console.log(err);
        return;
    }

    //5. exchange rolls and verify them
    const roll_reply = await fetch(window.location.origin + '/play/exchangeRolls', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            roll: roll_output
        })
    });
    try {
        let info = await roll_reply.json();
        console.log(info.msg);
        console.log("Opponent's roll: " + info.roll);
        let opponent_roll = info.roll;
        updateUI(roll_output, opponent_roll);
        let new_hash = await sha256(opponent_roll.toString() + binding_secret + opponent_binding_secret);
        console.log("Hash produced by opponent roll: " + new_hash);
        if (new_hash == opponent_hash) {
            console.log("Hashes of server are equal (Server is honest)");
        } else {
            console.log("Server cheated");
        }
    } catch (err) {
        console.log(err);
        return;
    }
    console.log("========= GAME OVER =========");
}
