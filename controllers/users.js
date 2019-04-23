/*
 * @Author: ghost 
 * @Date: 2018-05-08 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2018-05-11 14:22:51
 */
var Users = require('../models/users');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var Status = require('../utils/status').Status
var LOG = require('../logger/logger').logger
var UUIDV4 = require('uuid/v4')
var async = require('async');


var COMPONENT = "users";


exports.loginUser = function (req, res) {
    console.log("file path", req.files);
    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
    return res.status(apistatus.http.status).json(apistatus);
}




