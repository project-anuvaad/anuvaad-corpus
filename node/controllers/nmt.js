var Language = require('../models/language');
var NMT = require('../models/nmt');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger

var COMPONENT = "nmt";
const SATUS_ACTIVE = 'ACTIVE'

exports.fetchModels = function (req, res) {
    NMT.findByCondition({ status: SATUS_ACTIVE }, function (err, models) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, models).getRsp()
        return res.status(response.http.status).json(response);
    })

}

exports.updateModels = function (req, res) {
    if (!req.body || !req.body.model || !req.body.model.source_language_code || !req.body.model.target_language_code) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let model = req.body.model
    NMT.updateModel(model, function (err, doc) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.saveModels = function (req, res) {
    if (!req.body || !req.body.model || !req.body.model.source_language_code || !req.body.model.target_language_code) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let model = req.body.model
    Language.findByCondition({ language_code: model.source_language_code, status: SATUS_ACTIVE }, function (err, lang) {
        if (err || !lang || lang.length == 0) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        Language.findByCondition({ language_code: model.target_language_code, status: SATUS_ACTIVE }, function (err, lang) {
            if (err || !lang || lang.length == 0) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            model.created_on = new Date()
            model.status = SATUS_ACTIVE
            if (model.is_primary) {
                NMT.findByCondition({ is_primary: true, source_language_code: model.source_language_code, target_language_code: model.target_language_code }, function (err, modeldblist) {
                    if (modeldblist && modeldblist.length > 0) {
                        let modeldb = modeldblist[0]._doc
                        modeldb.is_primary = false
                        NMT.updateModel(modeldb, function (err, doc) {
                            NMT.saveModel(model, function (err, doc) {
                                if (err) {
                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                                let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                                return res.status(response.http.status).json(response);
                            })
                        })
                    }
                    else {
                        NMT.saveModel(model, function (err, doc) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                            return res.status(response.http.status).json(response);
                        })
                    }
                })
            }
            else {
                NMT.saveModel(model, function (err, doc) {
                    if (err) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                    return res.status(response.http.status).json(response);
                })
            }
        })
    })
}