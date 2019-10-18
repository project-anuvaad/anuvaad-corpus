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
const ES_SERVER_URL = process.env.GATEWAY_URL ? process.env.GATEWAY_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/admin/'
const USERS_REQ_URL = ES_SERVER_URL + 'users?count=1000'
const SCOPE_URL = ES_SERVER_URL + 'scopes?count=1000'
const PROFILE_BASE_URL = process.env.PROFILE_APP_URL ? process.env.PROFILE_APP_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/'
const PROFILE_REQ_URL = PROFILE_BASE_URL + 'corpus/get-profiles'


exports.listUsers = function (req, res) {
    axios.get(USERS_REQ_URL).then((api_res) => {
        if (api_res.data && api_res.data.users && Array.isArray(api_res.data.users)) {
            let userIds = []
            api_res.data.users.map((u) => {
                userIds.push(u.id)
            })
            axios.post(PROFILE_REQ_URL, { userids: userIds }).then((api_res) => {
                if (api_res.data) {
                    if (api_res.data.data && Array.isArray(api_res.data.data)) {
                        let response = new Response(StatusCode.SUCCESS, api_res.data.data).getRsp()
                        return res.status(response.http.status).json(response);
                    }
                }
            }).catch((e) => {
                LOG.error(e)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            })
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    }).catch((e) => {
        LOG.info(e)
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    })
}


exports.listRoles = function (req, res) {
    axios.get(SCOPE_URL).then((api_res) => {
        if (api_res.data && api_res.data.scopes && Array.isArray(api_res.data.scopes)) {
            let response = new Response(StatusCode.SUCCESS, api_res.data.scopes).getRsp()
            return res.status(response.http.status).json(response);
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    }).catch((e) => {
        LOG.info(e)
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    })
}


