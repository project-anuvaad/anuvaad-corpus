/*
 * @Author: ghost 
 * @Date: 2018-05-08 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2018-05-11 14:22:51
 */
var Users = require('../models/users');
var UserHighCourt = require('../models/user_high_court');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var Status = require('../utils/status').Status
var LOG = require('../logger/logger').logger
var UUIDV4 = require('uuid/v4')
var async = require('async');
var axios = require('axios');
const { exec } = require('child_process');


var COMPONENT = "users";
const ES_SERVER_URL = process.env.GATEWAY_URL ? process.env.GATEWAY_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/admin/'
const USERS_REQ_URL = ES_SERVER_URL + 'users'
const CREDENTIALS_URL = ES_SERVER_URL + 'credentials'
const SCOPE_URL = ES_SERVER_URL + 'scopes?count=1000'
const PROFILE_BASE_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/corpus/'
const PROFILE_REQ_URL = PROFILE_BASE_URL + 'get-profiles'


exports.listUsers = function (req, res) {
    axios.get(USERS_REQ_URL + '?count=1000').then((api_res) => {
        if (api_res.data && api_res.data.users && Array.isArray(api_res.data.users)) {
            let userIds = []
            api_res.data.users.map((u) => {
                userIds.push(u.id)
            })
            axios.post(PROFILE_REQ_URL, { userids: userIds }).then((api_res) => {
                if (api_res.data) {
                    if (api_res.data.data && Array.isArray(api_res.data.data)) {
                        let res_array = []
                        async.each(api_res.data.data, function (data, callback) {
                            let condition = { user_id: data.id }
                            UserHighCourt.findByCondition(condition, function (err, results) {
                                if (results && results.length > 0) {
                                    let user_court = results[0]._doc
                                    if (user_court) {
                                        data.high_court_code = user_court.high_court_code
                                    }
                                }
                                res_array.push(data)
                                callback()
                            })

                        }, function (err) {
                            let response = new Response(StatusCode.SUCCESS, res_array).getRsp()
                            return res.status(response.http.status).json(response);
                        });

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
            let roles = []
            api_res.data.scopes.map((res) => {
                if (res !== 'admin') {
                    roles.push(res)
                }
            })
            let response = new Response(StatusCode.SUCCESS, roles).getRsp()
            return res.status(response.http.status).json(response);
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    }).catch((e) => {
        LOG.error(e)
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    })
}

exports.updateUserStatus = function (req, res) {
    if (!req.body || !req.body.status || !req.body.username) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let api_req = {}
    api_req.status = req.body.status == 'DELETE' ? false : true
    axios.put(USERS_REQ_URL + '/' + req.body.username + '/status', api_req).then((api_res) => {
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    }).catch((e) => {
        LOG.error(e)
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    })
}

exports.createUser = function (req, res) {
    if (!req.body || !req.body.username || !req.body.password || !req.body.roles) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let user = req.body
    let roles = req.body.roles
    let user_to_be_saved = {}
    let high_court_code = req.body.high_court_code
    user_to_be_saved.username = user.username
    user_to_be_saved.firstname = user.firstname
    user_to_be_saved.lastname = user.lastname
    user_to_be_saved.email = user.email
    axios.post(USERS_REQ_URL, user_to_be_saved).then((api_res) => {
        let id = api_res.data.id
        let oauth = {}
        oauth.consumerId = id
        oauth.type = "oauth2"
        axios.post(CREDENTIALS_URL, oauth).then((api_res) => {
            let base_auth = {}
            base_auth.credential = {}
            base_auth.credential.scopes = roles
            base_auth.credential.password = user.password
            base_auth.consumerId = id
            base_auth.type = 'basic-auth'
            axios.post(CREDENTIALS_URL, base_auth).then((api_res) => {
                if (high_court_code) {
                    let user_high_court_obj = { high_court_code: high_court_code, user_id: id }
                    UserHighCourt.saveUserHighCourt(user_high_court_obj, function (error, results) {
                        if (error) {
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    })
                } else {
                    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                    return res.status(response.http.status).json(response);
                }
            }).catch((e) => {
                let apistatus = new APIStatus(e.response.status == 409 ? StatusCode.ERR_DATA_EXIST : StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            })
        }).catch((e) => {
            let apistatus = new APIStatus(e.response.status == 409 ? StatusCode.ERR_DATA_EXIST : StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        })
    }).catch((e) => {
        let apistatus = new APIStatus(e.response.status == 409 ? StatusCode.ERR_DATA_EXIST : StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    })
}


