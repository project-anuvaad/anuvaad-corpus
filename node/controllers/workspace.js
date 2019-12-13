var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var ParagraphWorkspace = require('../models/paragraph_workspace');
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger
var fs = require('fs');
var UUIDV4 = require('uuid/v4')
var COMPONENT = "workspace";

exports.saveParagraphWorkspace = function (req, res) {
    if (!req || !req.body || !req.body.paragraph_workspaces || !Array.isArray(req.body.paragraph_workspaces) || req.body.paragraph_workspaces.length <= 0) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    req.body.paragraph_workspaces.map((workspace) => {
        workspace.session_id = UUIDV4()
        fs.mkdir('corpusfiles/processing/' + workspace.session_id, function (e) {
            fs.mkdir('corpusfiles/processing/' + workspace.session_id + '/pipeline_stage_1', function (e) {
                fs.copyFile('/tmp/nginx/' + workspace.config_file_location, 'corpusfiles/processing/' + workspace.session_id + '/pipeline_stage_1/' + workspace.config_file_location, function (err) {
                    if (err) {
                        LOG.error(err)
                    }
                    else {
                        fs.copyFile('/tmp/nginx/' + workspace.csv_file_location, 'corpusfiles/processing/' + workspace.session_id + '/pipeline_stage_1/' + workspace.csv_file_location, function (err) {
                            if (err) {
                                LOG.error(err)
                            }
                            ParagraphWorkspace.save(req.body.paragraph_workspaces, function (err, models) {
                                if (err) {
                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                                let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                                return res.status(response.http.status).json(response);
                            })
                        });
                    }
                });
            })
        });
    })


}