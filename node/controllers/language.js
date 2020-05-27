var Language = require('../models/language');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger

var COMPONENT = "language";
const SATUS_ACTIVE = 'ACTIVE'

exports.fetchLanguages = function (req, res) {
    Language.findByCondition({status: SATUS_ACTIVE}, function (err, languages) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, languages).getRsp()
        return res.status(response.http.status).json(response);
    })

}

exports.updateLanguages = function(req, res){
    if (!req.body || !req.body.language || !req.body.language.language_code) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let language = req.body.language
    Language.updateLanguage(language, function (err, doc) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.saveLanguages = function (req, res) {
    if (!req.body || !req.body.language || !req.body.language.language_code || !req.body.language.language_name) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let language = req.body.language
    Language.findByCondition({ language_code: language.language_code, status: SATUS_ACTIVE }, function (err, lang) {
        LOG.debug(lang.length)
        if (lang && lang.length > 0) {
            let apistatus = new APIStatus(StatusCode.ERR_DATA_EXIST, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        language.status = SATUS_ACTIVE
        language.created_on = new Date()
        Language.saveLanguage(language, function (err, doc) {
            if (err) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
            return res.status(response.http.status).json(response);
        })
    })
}