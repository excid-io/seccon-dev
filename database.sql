CREATE USER IF NOT EXISTS 'netsec'@'%' IDENTIFIED BY 'netsec';

CREATE DATABASE IF NOT EXISTS gdpr;

USE gdpr;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS jwt_blacklist;
DROP TABLE IF EXISTS sec_details;
DROP TABLE IF EXISTS match_history;

CREATE TABLE users(
	id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	firstname VARCHAR(40), 
	lastname VARCHAR(40),
	username VARCHAR(100) UNIQUE, 
	password VARBINARY(256)
); 

CREATE TABLE jwt_blacklist(
	id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(600)
);

CREATE TABLE sec_details (    
	sid INT AUTO_INCREMENT PRIMARY KEY,    
    user_id INT,    vector BINARY(16),    
    salt BINARY(32),    skey BINARY(32),    
    FOREIGN KEY (user_id) REFERENCES users(id)
);
ALTER TABLE sec_details ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id);

CREATE TABLE match_history(
id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	user_id INT,
	client_roll INT,
	server_roll INT,
    time TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(id)
);
ALTER TABLE match_history ADD CONSTRAINT mh_fk_user_id FOREIGN KEY (user_id) REFERENCES users(id);

GRANT ALL PRIVILEGES ON GDPR.* TO 'netsec'@'%';
FLUSH PRIVILEGES;
