var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var UserRegisterSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var UserRegister = mongoose.model('UserRegister', UserRegisterSchema, 'user_register');

module.exports = UserRegister;