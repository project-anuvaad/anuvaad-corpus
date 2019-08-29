/**
 * users model for mysql db
 */
var UUIDV4 = require('uuid/v4')
var COMPONENT = "users"



function Users(token, interest_captured, account_number, email, password, partner_id) {
    this.email = email;
    this.password = password;
    this.partner_id = partner_id;
    if (token == null)
        this.token = UUIDV4();
    else
        this.token = token
    this.interest_captured = interest_captured;
    this.account_number = account_number;
}




module.exports = Users;
