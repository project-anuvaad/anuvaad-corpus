var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var ParaghraphWorkspace = require('../models/paragraph_workspace');
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger
var COMPONENT = "workspace";

exports.saveParagraphWorkspace = function (req, res) {
    if(!req || !req.body || !req.body.paragraph_workspaces){
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    ParaghraphWorkspace.save(req.body.paragraph_workspaces, function (err, models) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    })

}