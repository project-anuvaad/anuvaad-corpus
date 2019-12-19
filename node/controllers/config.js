var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var Config = require('../models/configs');
var LOG = require('../logger/logger').logger

var COMPONENT = "config";
const TYPE_DEFAULT = 'DEFAULT'

exports.fetchDefaultConfigs = function (req, res) {
    Config.findByCondition({type: TYPE_DEFAULT}, function (err, configs) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        else if(!configs || !Array.isArray(configs) || configs.length <=0){
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, configs[0]).getRsp()
        return res.status(response.http.status).json(response);
    })

}