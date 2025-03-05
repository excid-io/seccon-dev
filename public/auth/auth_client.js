
async function login() {
    //get username and password from form
    let uname = document.getElementById('login_username').value;
    let pword = document.getElementById('login_password').value;

    //send credentials to server
    fetch(window.location.origin + '/auth/login', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: uname,
            password: pword
        })
    })
        .then(r => r.json())
        .then(r => {
            if (r.auth == false) {
                document.getElementById('login_password').value = "";
                alert(r.msg);
            } else {
                window.location.href = window.location.origin + '/play';
            }
        })
        .catch(err => console.log(err));
}

async function register() {
    //get user info from form
    let fname = document.getElementById('register_first_name').value;
    let lname = document.getElementById('register_last_name').value;
    let uname = document.getElementById('register_username').value;
    let pword = document.getElementById('register_password').value;
    let pword2 = document.getElementById('register_password2').value;

    //send credentials to server
    fetch(window.location.origin + '/auth/register', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            first_name: fname,
            last_name: lname,
            username: uname,
            password: pword,
            password2: pword2
        })
    })
        .then(r => r.json())
        .then(r => {
            if (r.auth == true) {
                clearRegisterForm();
                show_login();
            } else {
                document.getElementById('register_username').value = "";
            }
            alert(r.msg);
        })
        .catch(err => console.log(err));
}

function clearRegisterForm() {
    document.getElementById('register_first_name').value = "";
    document.getElementById('register_last_name').value = "";
    document.getElementById('register_username').value = "";
    document.getElementById('register_password').value = "";
    document.getElementById('register_password2').value = "";
}

function clearLoginForm() {
    document.getElementById('login_username').value = "";
    document.getElementById('login_password').value = "";
}

var a = document.getElementById("loginBtn");
var b = document.getElementById("registerBtn");
var x = document.getElementById("login");
var y = document.getElementById("register");

function show_login() {
    clearRegisterForm();
    x.style.left = "4px";
    y.style.right = "-520px";
    a.className += " white-btn";
    b.className = "btn";
    x.style.opacity = 1;
    y.style.opacity = 0;
}

function show_register() {
    clearLoginForm();
    x.style.left = "-510px";
    y.style.right = "5px";
    a.className = "btn";
    b.className += " white-btn";
    x.style.opacity = 0;
    y.style.opacity = 1;
}

function myMenuFunction() {
    var i = document.getElementById("navMenu");

    if (i.className === "nav-menu") {
        i.className += " responsive";
    } else {
        i.className = "nav-menu";
    }
}

function check() {
    var input = document.getElementById("register_password").value;

    input = input.trim();
    document.getElementById("register_password").value = input;
    //document.getElementById("count").innerText = "Length : " + input.length;
    if (input.length >= 8) {
        document.getElementById("check0").style.color = "green";
    }
    else {
        document.getElementById("check0").style.color = "white";
    }

    if (input.length <= 20) {
        document.getElementById("check1").style.color = "green";
    }
    else {
        document.getElementById("check1").style.color = "white";
    }

    if (input.match(/[0-9]/i)) {
        document.getElementById("check2").style.color = "green";
    }
    else {
        document.getElementById("check2").style.color = "white";
    }

    if (input.match(/[^A-Za-z0-9-' ']/i)) {
        document.getElementById("check3").style.color = "green";
    }
    else {
        document.getElementById("check3").style.color = "white";
    }

    if (input.match(' ')) {
        document.getElementById("check4").style.color = "white";
    }
    else {
        document.getElementById("check4").style.color = "green";
    }

}
