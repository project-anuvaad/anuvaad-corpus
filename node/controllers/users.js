/*
 * @Author: ghost 
 * @Date: 2018-05-08 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2018-05-11 14:22:51
 */
var Users = require('../models/users');
var UserHighCourt = require('../models/user_high_court');
var BaseModel = require('../models/basemodel');
var UserRegister = require('../models/user_register');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var Status = require('../utils/status').Status
var LOG = require('../logger/logger').logger
var Mailer = require('../utils/mailer')
var UUIDV4 = require('uuid/v4')
var async = require('async');
var axios = require('axios');
const { exec } = require('child_process');
const STATUS_PENDING = 'PENDING'


var COMPONENT = "users";
const BASE_URL = process.env.APPLICATION_URL ? process.env.APPLICATION_URL : 'https://developers.anuvaad.org/'
const ES_SERVER_URL = process.env.GATEWAY_URL ? process.env.GATEWAY_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/admin/'
const USERS_REQ_URL = ES_SERVER_URL + 'users'
const CREDENTIALS_URL = ES_SERVER_URL + 'credentials'
const SCOPE_URL = ES_SERVER_URL + 'scopes?count=1000'
const PROFILE_BASE_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/corpus/'
const PROFILE_REQ_URL = PROFILE_BASE_URL + 'get-profiles'
const INTERACTIVE_EDITOR_ROLE = 'interactive-editor'

var html_content = `<!DOCTYPE html>
<html>

<head>
   
</head>

<body style="margin: 0; padding: 10px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="630"
        style="font-family: Arial, Helvetica, sans-serif;">
        <tr bgcolor="#f1f5f7">
            <td align="center" style=" padding:  0px 0 30px 0;">

                <img src="https://auth.anuvaad.org/download/anuvaad_logo.png" alt="anuvaad logo" width="630" height="250px"
                    style="display: block;" />
            </td>
        </tr>
        <tr bgcolor="#f1f5f7">
            <td align="center" style="color:black;padding: 10px 0 5px 0; ">
                <h1 style="color:#003366 ;margin-bottom: 10px; font-family: Arial, Helvetica, sans-serif;">Activate your Account</h1>
                <p style="font-size: 8x; align-items:center;font-style: italic;">You've received this email because you have registered on 
                <br/> <a href="https://users.anuvaad.org" target="_blank" style="text-decoration: none;color:#1ca9c9">users.anuvaad.org.</a>  If it's not you, please click here to 
                <a href="" target="_blank" style="text-decoration:none;color:#1ca9c9">unsubscribe.</a></p>
                <br/>
                <hr style="height:2px; border-width: 0; width: 80%; background-Color:  #D8D8D8; color: #D8D8D8;border: 0;">
            </td>
        </tr>
        <tr bgcolor="#f1f5f7">
            <td align="center" style="padding: 5px 0 100px 0;">
                <p style="font-size: 16px; font-family: Arial, Helvetica, sans-serif;">Please click here to confirm yourself and activate your account.</p>
                <a href="$REG_URL$"> 
                <button  variant="contained" aria-label="edit" style=
                    "cursor:pointer;width: 66%; height:42px; margin-Bottom: 2%; margin-Top: 5px;
                    background-Color: #1ca9c9; color: white; border-radius:25px ;border:0; font-size:15px ; font-family: Arial, Helvetica, sans-serif;"
                  >
                        Confirm Email</button>
                    </a>
                <!-- <button type="button" class="btn btn-success btn-lg" ><b>Sign Up</b></button>   -->
                <p style="font-size: 15px; font-family: Arial, Helvetica, sans-serif;">You can also paste the below link on your browser tab <br/>and open it to create a password.</p>
            </td>
        </tr>
    </table>
</body>

</html>`


exports.listUsers = function (req, res) {
    axios.get(USERS_REQ_URL + '?count=100000').then((api_res) => {
        if (api_res.data && api_res.data.users && Array.isArray(api_res.data.users)) {
            let userIds = []
            api_res.data.users.map((u) => {
                userIds.push(u.id)
            })
            LOG.info(userIds)
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
        LOG.debug(e)
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


exports.signUpUser = function (req, res) {
    if (!req.body || !req.body.password || !req.body.email || !req.body.firstname || !req.body.lastname) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let user = req.body
    let user_to_be_saved = {}
    let high_court_code = req.body.high_court_code
    user_to_be_saved.username = user.email
    user_to_be_saved.firstname = user.firstname
    user_to_be_saved.lastname = user.lastname
    user_to_be_saved.email = user.email
    user_to_be_saved.isActive = false
    axios.post(USERS_REQ_URL, user_to_be_saved).then((api_res) => {
        let id = api_res.data.id
        let oauth = {}
        oauth.consumerId = id
        oauth.type = "oauth2"
        axios.post(CREDENTIALS_URL, oauth).then((api_res) => {
            let base_auth = {}
            base_auth.credential = {}
            base_auth.credential.scopes = [INTERACTIVE_EDITOR_ROLE]
            base_auth.credential.password = user.password
            base_auth.consumerId = id
            base_auth.type = 'basic-auth'
            axios.post(CREDENTIALS_URL, base_auth).then((api_res) => {
                // if (high_court_code) {
                //     let user_high_court_obj = { high_court_code: high_court_code, user_id: id }
                //     UserHighCourt.saveUserHighCourt(user_high_court_obj, function (error, results) {
                //         if (error) {
                //             let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                //             return res.status(apistatus.http.status).json(apistatus);
                //         }
                //         let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                //         return res.status(response.http.status).json(response);
                //     })
                // } else {
                let r_id = UUIDV4()
                let user_register = { user_id: id, r_id: r_id, created_on: new Date(), status: STATUS_PENDING }
                BaseModel.saveData(UserRegister, [user_register], function (err, doc) {
                    if (err) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    let url = BASE_URL + '/activate?u_id=' + id + '&r_id=' + r_id
                    var html_content_data = html_content.replace('$REG_URL$',url)
                    Mailer.send_email(user.email, 'Welcome to Anuvaad', html_content_data)
                    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                    return res.status(response.http.status).json(response);
                })

                // }
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


