var HighCourt = require('../models/high_courts');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger

var COMPONENT = "high_court";
const SATUS_ACTIVE = 'ACTIVE'

exports.fetchHighCourts = function (req, res) {
    HighCourt.findByCondition({status: SATUS_ACTIVE}, function (err, highCourts) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, highCourts).getRsp()
        return res.status(response.http.status).json(response);
    })

}

exports.updateHighCourts = function(req, res){
    if (!req.body || !req.body.high_court || !req.body.high_court.high_court_code) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let high_court = req.body.high_court
    HighCourt.updateHighCourt(high_court, function (err, doc) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.saveHighCourt = function (req, res) {
    if (!req.body || !req.body.high_court || !req.body.high_court.high_court_code || !req.body.high_court.high_court_name) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let high_court = req.body.high_court
    HighCourt.findByCondition({ high_court_code: high_court.high_court_code, status: SATUS_ACTIVE }, function (err, court) {
        if (court && court.length > 0) {
            let apistatus = new APIStatus(StatusCode.ERR_DATA_EXIST, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        high_court.status = SATUS_ACTIVE
        high_court.created_on = new Date()
        HighCourt.saveHighCourt(high_court, function (err, doc) {
            if (err) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
            return res.status(response.http.status).json(response);
        })
    })
}