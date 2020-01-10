var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var ParagraphWorkspace = require('../models/paragraph_workspace');
var MTWorkspace = require('../models/mt_workspace');
var TranslationProcess = require('../models/translation_process');
var UserHighCourt = require('../models/user_high_court');
var HighCourt = require('../models/high_courts');
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger
var KafkaProducer = require('../kafka/producer');
var fs = require('fs');
var UUIDV4 = require('uuid/v4')
var COMPONENT = "workspace";
var axios = require('axios');
var es = require('../db/elastic');

const BASE_PATH_PIPELINE_1 = 'corpusfiles/processing/pipeline_stage_1/'
const BASE_PATH_PIPELINE_2 = 'corpusfiles/processing/pipeline_stage_2/'
const STATUS_PROCESSING = 'PROCESSING'
const STATUS_PROCESSED = 'PROCESSED'
const STEP_IN_PROGRESS = 'IN-PROGRESS'
const STEP_TOKENIZE = 'At Step1'
const STEP_SENTENCE = 'At Step2'
const STEP_ERROR = 'FAILED'
const ES_SERVER_URL = process.env.GATEWAY_URL ? process.env.GATEWAY_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/admin/'
const USER_INFO_URL = ES_SERVER_URL + 'users'
var async = require('async');

exports.updateError = function (req) {
    if (!req || !req.session_id) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        ParagraphWorkspace.findOne({ session_id: req.session_id }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('ParagraphWorkspace not found [%s]', req)
            } else {
                workspace._doc.step = STEP_ERROR
                ParagraphWorkspace.updateParagraphWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.info('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.handleMTRequest = function (req) {
    if (!req || !req.data || !req.data.process_id) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        MTWorkspace.findOne({ session_id: req.data.process_id }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('MTWorkspace not found [%s]', req)
            } else {
                if (req.data.status === STEP_ERROR) {
                    workspace._doc.step = STEP_ERROR
                } else {
                    workspace._doc.status = STATUS_PROCESSED
                    workspace._doc.sentence_file = req.data.file_name
                    workspace._doc.sentence_count = req.data.sentence_count
                    fs.copyFile(BASE_PATH_PIPELINE_2 + workspace._doc.session_id + '/' + req.data.file_name, 'nginx/' + req.data.file_name, function (err) {
                        if (err) {
                            LOG.error(err)
                        } else {
                            LOG.info('File transfered [%s]', req.data.file_name)
                        }
                    })
                }
                MTWorkspace.updateMTWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.info('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.handleSentenceRequest = function (req) {
    if (!req || !req.data || !req.data.processId) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        ParagraphWorkspace.findOne({ session_id: req.data.processId }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('ParagraphWorkspace not found [%s]', req)
            } else {
                workspace._doc.step = STEP_SENTENCE
                workspace._doc.status = STATUS_PROCESSED
                workspace._doc.sentence_file = req.data.sentencesFile
                workspace._doc.sentence_count = req.data.sentencesCount
                fs.copyFile(BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.data.sentencesFile, 'nginx/' + req.data.sentencesFile, function (err) {
                    if (err) {
                        LOG.error(err)
                    } else {
                        LOG.info('File transfered [%s]', req.data.negativeTokenFile)
                    }
                })
                ParagraphWorkspace.updateParagraphWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.info('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.handleTokenizeRequest = function (req) {
    if (!req || !req.data || !req.data.processId) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        ParagraphWorkspace.findOne({ session_id: req.data.processId }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('ParagraphWorkspace not found [%s]', req)
            } else {
                workspace._doc.step = STEP_TOKENIZE
                workspace._doc.token_file = req.data.tokenFile
                workspace._doc.token_count = req.data.tokenCount
                workspace._doc.negative_token_file = req.data.negativeTokenFile
                workspace._doc.negative_token_count = req.data.negativeTokenCount
                fs.copyFile(BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.data.tokenFile, 'nginx/' + req.data.tokenFile, function (err) {
                    if (err) {
                        LOG.error(err)
                    } else {
                        LOG.info('File transfered [%s]', req.data.tokenFile)
                    }
                })
                fs.copyFile(BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.data.negativeTokenFile, 'nginx/' + req.data.negativeTokenFile, function (err) {
                    if (err) {
                        LOG.error(err)
                    } else {
                        LOG.info('File transfered [%s]', req.data.negativeTokenFile)
                    }
                })
                ParagraphWorkspace.updateParagraphWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.info('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.fetchMTWorkspaceDetail = function (req, res) {
    if (!req || !req.query || !req.query.session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    LOG.info('Request came for fetchMTWorkspaceDetail [%s]', req.query.session_id)
    let session_id = req.query.session_id
    MTWorkspace.findOne({ session_id: session_id }, function (error, workspace) {
        if (error) {
            LOG.error(error)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, workspace).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.migrateOldData = function (req, res) {
    TranslationProcess.findByCondition({ "basename": { "$lt": '1578421800' } }, function (err, translation_process) {
        if (translation_process) {
            async.each(translation_process, function (translation, callback) {
                if (translation._doc.created_by) {
                    UserHighCourt.findByCondition({ user_id: translation._doc.created_by }, function (err, docs) {
                        if (docs && Array.isArray(docs) && docs.length > 0) {
                            let user_high_court = docs[0]['_doc']
                            HighCourt.findByCondition({ high_court_code: user_high_court.high_court_code }, function (err, high_courts) {
                                if (high_courts && Array.isArray(high_courts) && high_courts.length > 0) {
                                    let doc_report = {}
                                    doc_report['source_lang'] = translation._doc.sourceLang
                                    doc_report['target_lang'] = translation._doc.targetLang
                                    doc_report['user_id'] = translation._doc.created_by
                                    doc_report['created_on'] = translation._doc.created_on
                                    doc_report['high_court_code'] = high_courts[0]._doc.high_court_code
                                    doc_report['high_court_name'] = high_courts[0]._doc.high_court_name
                                    es.create({
                                        index: 'doc_report_migrate_old',
                                        id: translation._doc._id,
                                        body: doc_report
                                      });
                                }
                                callback()
                            })
                        } else {
                            callback()
                        }
                    })
                }
                else {
                    callback()
                }
            })
        }
        // LOG.info(translation_process)
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.fetchParagraphWorkspaceDetail = function (req, res) {
    if (!req || !req.query || !req.query.session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    LOG.info('Request came for fetchParagraphWorkspaceDetail [%s]', req.query.session_id)
    let session_id = req.query.session_id
    ParagraphWorkspace.findOne({ session_id: session_id }, function (error, workspace) {
        if (error) {
            LOG.error(error)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, workspace).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.fetchMTWorkspace = function (req, res) {
    let status = req.query.status
    let step = req.query.step
    let target_language = req.query.target_language
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    var search_param = req.query.search_param
    let condition = {}
    if (status) {
        condition = { status: status }
    }
    if (search_param) {
        condition['title'] = new RegExp(search_param, "i")
    }
    if (target_language) {
        condition['target_language'] = target_language
    }
    if (step) {
        condition['step'] = step
    }
    MTWorkspace.countDocuments(condition, function (err, count) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        MTWorkspace.findByCondition(condition, pagesize, pageno, function (err, models) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            let response = new Response(StatusCode.SUCCESS, models, count).getRsp()
            return res.status(response.http.status).json(response);
        })
    })
}

exports.fetchParagraphWorkspace = function (req, res) {
    let status = req.query.status
    let step = req.query.step
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    var search_param = req.query.search_param
    let condition = {}
    if (status) {
        condition = { status: status, stage: 1 }
    }
    if (search_param) {
        condition['title'] = new RegExp(search_param, "i")
    }
    if (step) {
        condition['step'] = step
    }
    ParagraphWorkspace.countDocuments(condition, function (err, count) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        ParagraphWorkspace.findByCondition(condition, pagesize, pageno, function (err, models) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            let response = new Response(StatusCode.SUCCESS, models, count).getRsp()
            return res.status(response.http.status).json(response);
        })
    })
}

exports.startTokenization = function (req, res) {
    if (!req || !req.body || !req.body.paragraph_workspace || !req.body.paragraph_workspace.negative_token_file || !req.body.paragraph_workspace.token_file) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    ParagraphWorkspace.findOne({ session_id: req.body.paragraph_workspace.session_id }, function (error, workspace) {
        if (error) {
            LOG.error(error)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        } else if (!workspace) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        workspace._doc.token_file = req.body.paragraph_workspace.token_file
        workspace._doc.negative_token_file = req.body.paragraph_workspace.negative_token_file
        workspace._doc.step = STEP_SENTENCE
        fs.copyFile('nginx/' + req.body.paragraph_workspace.token_file, BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.body.paragraph_workspace.token_file, function (err) {
            if (err) {
                LOG.error(err)
            } else {
                LOG.info('File transfered [%s]', req.body.paragraph_workspace.token_file)
            }
        })
        fs.copyFile('nginx/' + req.body.paragraph_workspace.negative_token_file, BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.body.paragraph_workspace.negative_token_file, function (err) {
            if (err) {
                LOG.error(err)
            } else {
                LOG.info('File transfered [%s]', req.body.paragraph_workspace.negative_token_file)
            }
        })
        ParagraphWorkspace.updateParagraphWorkspace(workspace._doc, (error, results) => {
            if (error) {
                LOG.error(error)
            }
            else {
                KafkaProducer.getInstance().getProducer((err, producer) => {
                    if (err) {
                        LOG.error("Unable to connect to KafkaProducer");
                    } else {
                        LOG.info("KafkaProducer connected")
                        let payloads = [
                            {
                                topic: 'sentencesext', messages: JSON.stringify({ data: workspace._doc }), partition: 0
                            }
                        ]
                        producer.send(payloads, function (err, data) {
                            LOG.info('Produced')
                        });
                    }
                })
                LOG.info('Data updated successfully [%s]', JSON.stringify(req.body.paragraph_workspace))
                let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                return res.status(response.http.status).json(response);
            }
        })

    })
}

exports.startMTProcess = function (req, res) {

}

exports.saveMTWorkspace = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.mt_workspace || !req.body.mt_workspace.selected_workspaces) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let workspace = req.body.mt_workspace
    workspace.session_id = UUIDV4()
    axios.get(USER_INFO_URL + '/' + userId).then((api_res) => {
        workspace.status = STATUS_PROCESSING
        workspace.step = STEP_IN_PROGRESS
        workspace.created_at = new Date()
        workspace.created_by = userId
        workspace.selected_files = []
        if (api_res.data) {
            workspace.username = api_res.data.username
        }
        MTWorkspace.save([workspace], function (err, models) {
            if (err) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            fs.mkdir(BASE_PATH_PIPELINE_2 + workspace.session_id, function (e) {
                if (e) {
                    LOG.error(e)
                }
                async.each(req.body.mt_workspace.selected_workspaces, function (selected_workspace, callback) {
                    workspace.selected_files.push(selected_workspace.sentence_file)
                    fs.copyFile(BASE_PATH_PIPELINE_1 + selected_workspace.session_id + '/' + selected_workspace.sentence_file, BASE_PATH_PIPELINE_2 + workspace.session_id + '/' + selected_workspace.sentence_file, function (err) {
                        if (err) {
                            LOG.error(err)
                        } else {
                            LOG.info('File transfered [%s]', selected_workspace.sentence_file)
                        }
                        callback()
                    })

                }, function (err) {
                    KafkaProducer.getInstance().getProducer((err, producer) => {
                        if (err) {
                            LOG.error("Unable to connect to KafkaProducer");
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        } else {
                            LOG.info("KafkaProducer connected")
                            workspace.use_latest = false
                            let payloads = [
                                {
                                    topic: 'sentencesmt', messages: JSON.stringify({ data: workspace }), partition: 0
                                }
                            ]
                            LOG.info('Sending message', payloads)
                            producer.send(payloads, function (err, data) {
                                let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                                return res.status(response.http.status).json(response);
                            });
                        }
                    })
                });
            })
        })
    }).catch((e) => {
        LOG.error(e)
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    })
}

exports.saveParagraphWorkspace = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.paragraph_workspace) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let workspace = req.body.paragraph_workspace
    workspace.session_id = UUIDV4()
    fs.mkdir(BASE_PATH_PIPELINE_1 + workspace.session_id, function (e) {
        fs.copyFile('nginx/' + workspace.config_file_location, BASE_PATH_PIPELINE_1 + workspace.session_id + '/' + workspace.config_file_location, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            else {
                fs.copyFile('nginx/' + workspace.paragraph_file_location, BASE_PATH_PIPELINE_1 + workspace.session_id + '/' + workspace.paragraph_file_location, function (err) {
                    if (err) {
                        LOG.error(err)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    axios.get(USER_INFO_URL + '/' + userId).then((api_res) => {
                        workspace.status = STATUS_PROCESSING
                        workspace.stage = 1
                        workspace.step = STEP_IN_PROGRESS
                        workspace.created_at = new Date()
                        workspace.created_by = userId
                        if (api_res.data) {
                            workspace.username = api_res.data.username
                        }
                        ParagraphWorkspace.save([workspace], function (err, models) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            models.ops.map((data) => {
                                KafkaProducer.getInstance().getProducer((err, producer) => {
                                    if (err) {
                                        LOG.error("Unable to connect to KafkaProducer");
                                    } else {
                                        LOG.info("KafkaProducer connected")
                                        let payloads = [
                                            {
                                                topic: 'tokenext', messages: JSON.stringify({ data: data }), partition: 0
                                            }
                                        ]
                                        producer.send(payloads, function (err, data) {
                                            LOG.info('Produced')
                                        });
                                    }
                                })
                            })

                            let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                            return res.status(response.http.status).json(response);
                        })
                    })
                });
            }
        });
    })


}