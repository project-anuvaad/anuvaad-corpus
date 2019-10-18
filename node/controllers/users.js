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
var axios = require('axios');


var COMPONENT = "users";
const ES_SERVER_URL = process.env.MONGO_URL ? process.env.GATEWAY_URL : 'http://localhost:9876/'
const USERS_REQ_URL = ES_SERVER_URL + 'users?count=1000'



exports.listUsers = function (req, res) {
    axios.get(USERS_REQ_URL).then((api_res) => {
        if (api_res.data && api_res.data.users && Array.isArray(api_res.data.users)) {
            let response = new Response(StatusCode.SUCCESS, api_res.data.users).getRsp()
            return res.status(response.http.status).json(response);
        }
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }).catch((e)=>{
        LOG.info(e)
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    })
}




