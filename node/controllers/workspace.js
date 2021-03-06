var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var ParagraphWorkspace = require('../models/paragraph_workspace');
var MTWorkspace = require('../models/mt_workspace');
var SentencePair = require('../models/sentence_pair');
var SentencePairUnchecked = require('../models/sentence_pair_unchecked');
var SearchReplaceWorkspace = require('../models/search_replace_workspace');
var CompositionWorkspace = require('../models/composition_workspace');
var TranslationProcess = require('../models/translation_process');
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger
var KafkaProducer = require('../kafka/producer');
var CSVReader = require('../utils/csv-reader');
var fs = require('fs');
var UUIDV4 = require('uuid/v4')
var COMPONENT = "workspace";
var axios = require('axios');
var es = require('../db/elastic');

const BASE_PATH_PIPELINE_1 = 'corpusfiles/processing/pipeline_stage_1/'
const BASE_PATH_PIPELINE_2 = 'corpusfiles/processing/pipeline_stage_2/'
const BASE_PATH_PIPELINE_3 = 'corpusfiles/processing/pipeline_stage_3/'
const BASE_PATH_PIPELINE_4 = 'corpusfiles/processing/pipeline_stage_4/'
const BASE_PATH_NGINX = 'nginx/'
const STATUS_PROCESSING = 'PROCESSING'
const STATUS_PROCESSED = 'PROCESSED'
const STEP_IN_PROGRESS = 'IN-PROGRESS'
const STEP_TOKENIZE = 'At Step1'
const STEP_SENTENCE = 'At Step2'
const STEP_ERROR = 'FAILED'
const STEP_COMPLETED = 'COMPLETED'
const PYTHON_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/corpus/'
const CORPUS_TOOLS_URL = process.env.CORPUS_TOOLS_URL ? process.env.CORPUS_TOOLS_URL : 'http://gateway_tools:5099/'
const ES_SERVER_URL = process.env.GATEWAY_URL ? process.env.GATEWAY_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/admin/'
const USER_INFO_URL = ES_SERVER_URL + 'users'
const CORPUS_REPORT_URL = CORPUS_TOOLS_URL + 'calculate-stats'

const TOPIC_STAGE_1 = 'tokenext'
const TOPIC_STAGE_1_STEP_2 = 'sentencesext'
const TOPIC_STAGE_2 = 'sentencesmt'
const TOPIC_STAGE_3 = 'searchreplace'
const TOPIC_STAGE_4 = 'composition'
const PATH_SEARCH_REPLACE = 'search_replace'
const PATH_WRITE_TO_FILE = 'write_to_file'
const PATH_FILE_MERGER = 'file_merger'
const STATUS_EDITING = 'EDITING'

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
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.handleSearchReplaceErrorRequest = function (req) {
    if (!req || !req.data || (!req.data.processId && !req.data.process_id)) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        let process_id = req.data.processId ? req.data.processId : req.data.process_id
        SearchReplaceWorkspace.findOne({ session_id: process_id }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('SearchReplaceWorkspace not found [%s]', req)
            } else {
                workspace._doc.step = STEP_ERROR
                SearchReplaceWorkspace.updateSearchReplaceWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}
exports.handleMTErrorRequest = function (req) {
    if (!req || !req.data || !req.data.processId) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        MTWorkspace.findOne({ session_id: req.data.processId }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('MTWorkspace not found [%s]', req)
            } else {
                workspace._doc.step = STEP_ERROR
                MTWorkspace.updateMTWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
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
                    fs.copyFile(BASE_PATH_PIPELINE_2 + workspace._doc.session_id + '/' + req.data.file_name, BASE_PATH_NGINX + req.data.file_name, function (err) {
                        if (err) {
                            LOG.error(err)
                        } else {
                            LOG.debug('File transfered [%s]', req.data.file_name)
                        }
                    })
                }
                MTWorkspace.updateMTWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.handleWriteToFileRequest = function (req) {
    if (!req || !req.data || !req.data.process_id) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        SearchReplaceWorkspace.findOne({ session_id: req.data.process_id }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('SearchReplaceWorkspace not found [%s]', req)
            } else {
                if (req.data.status === STEP_ERROR) {
                    workspace._doc.step = STEP_ERROR
                } else {
                    workspace._doc.status = STATUS_PROCESSED
                    workspace._doc.step = STEP_COMPLETED
                    workspace._doc.sentence_count = req.data.sentence_count
                    workspace._doc.sentence_count_rejected = req.data.sentence_count_rejected
                    workspace._doc.sentence_file_full_path = BASE_PATH_PIPELINE_3 + req.data.process_id + '/' + req.data.files
                    workspace._doc.source_file_full_path = BASE_PATH_PIPELINE_3 + req.data.process_id + '/' + req.data.source_file
                    workspace._doc.target_file_full_path = BASE_PATH_PIPELINE_3 + req.data.process_id + '/' + req.data.target_file
                    workspace._doc.sentence_file = req.data.files
                }
                fs.copyFile(BASE_PATH_PIPELINE_3 + req.data.process_id + '/' + req.data.files, BASE_PATH_NGINX + req.data.files, function (err) {
                    if (err) {
                        LOG.error(err)
                    } else {
                        LOG.debug('File transfered [%s]', req.data.files)
                    }
                })
                SearchReplaceWorkspace.updateSearchReplaceWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.handleCompositionRequest = function(req){
    if (!req || !req.data || !req.data.process_id) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        CompositionWorkspace.findOne({ session_id: req.data.process_id }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('CompositionWorkspace not found [%s]', req)
            } else {
                if (req.data.status === STEP_ERROR) {
                    workspace._doc.step = STEP_ERROR
                } else {
                    workspace._doc.status = STATUS_PROCESSED
                    workspace._doc.step = STEP_COMPLETED
                    workspace._doc.sentence_count = req.data.sentence_count
                    workspace._doc.sentence_file_full_path = BASE_PATH_PIPELINE_4 + req.data.process_id + '/' + req.data.files
                    workspace._doc.source_file_full_path = BASE_PATH_PIPELINE_4 + req.data.process_id + '/' + req.data.source_file
                    workspace._doc.target_file_full_path = BASE_PATH_PIPELINE_4 + req.data.process_id + '/' + req.data.target_file
                    workspace._doc.sentence_file = req.data.files
                }
                fs.copyFile(BASE_PATH_PIPELINE_4 + req.data.process_id + '/' + req.data.files, BASE_PATH_NGINX + req.data.files, function (err) {
                    if (err) {
                        LOG.error(err)
                    } else {
                        LOG.debug('File transfered [%s]', req.data.files)
                    }
                })
                CompositionWorkspace.updateCompositionWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.handleSearchReplaceRequest = function (req) {
    if (!req || !req.data || !req.data.process_id) {
        LOG.error('Data missing for [%s]', JSON.stringify(req))
    } else {
        SearchReplaceWorkspace.findOne({ session_id: req.data.process_id }, function (error, workspace) {
            if (error) {
                LOG.error(error)
            }
            else if (!workspace) {
                LOG.error('SearchReplaceWorkspace not found [%s]', req)
            } else {
                if (req.data.status === STEP_ERROR) {
                    workspace._doc.step = STEP_ERROR
                } else {
                    workspace._doc.step = STATUS_EDITING
                    workspace._doc.sentence_count = req.data.sentence_count
                }
                SearchReplaceWorkspace.updateSearchReplaceWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
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
                fs.copyFile(BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.data.sentencesFile, BASE_PATH_NGINX + req.data.sentencesFile, function (err) {
                    if (err) {
                        LOG.error(err)
                    } else {
                        LOG.debug('File transfered [%s]', req.data.negativeTokenFile)
                    }
                })
                ParagraphWorkspace.updateParagraphWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
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
                fs.copyFile(BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.data.tokenFile, BASE_PATH_NGINX + req.data.tokenFile, function (err) {
                    if (err) {
                        LOG.error(err)
                    } else {
                        LOG.debug('File transfered [%s]', req.data.tokenFile)
                    }
                })
                fs.copyFile(BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.data.negativeTokenFile, BASE_PATH_NGINX + req.data.negativeTokenFile, function (err) {
                    if (err) {
                        LOG.error(err)
                    } else {
                        LOG.debug('File transfered [%s]', req.data.negativeTokenFile)
                    }
                })
                ParagraphWorkspace.updateParagraphWorkspace(workspace._doc, (error, results) => {
                    if (error) {
                        LOG.error(error)
                    }
                    else {
                        LOG.debug('Data updated successfully [%s]', JSON.stringify(req))
                    }
                })
            }
        })
    }
}

exports.fetchSearchReplaceWorkspaceDetail = function (req, res) {
    if (!req || !req.query || !req.query.session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let session_id = req.query.session_id
    SearchReplaceWorkspace.findOne({ session_id: session_id }, function (error, workspace) {
        if (error) {
            LOG.error(error)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, workspace).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.fetchCompositionWorkspaceDetail = function (req, res){
    if (!req || !req.query || !req.query.session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let session_id = req.query.session_id
    CompositionWorkspace.findOne({ session_id: session_id }, function (error, workspace) {
        if (error) {
            LOG.error(error)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, workspace).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.fetchMTWorkspaceDetail = function (req, res) {
    if (!req || !req.query || !req.query.session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    LOG.debug('Request came for fetchMTWorkspaceDetail [%s]', req.query.session_id)
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
    axios.get('http://' + process.env.ES_HOSTS + ':9200/doc_report/_search?pretty=true&size=1000').then(function (response) {
        let data = response.data;
        let hits = data.hits
        async.each(hits.hits, function (h, callback) {
            let source = h._source
            if (!source.document_id) {
                TranslationProcess.findByCondition({ "created_on": source.created_on }, function (err, translation_process) {
                    if (translation_process && Array.isArray(translation_process) && translation_process.length > 0) {
                        let translation_process_obj = translation_process[0]._doc
                        axios.post('http://' + process.env.ES_HOSTS + ':9200/doc_report/_update/' + h._id, {
                            "script": {
                                "source": "ctx._source.document_id = params.document_id",
                                "lang": "painless",
                                "params": {
                                    "document_id": translation_process_obj.basename
                                }
                            }
                        }).then(function (response) {
                            axios.get(PYTHON_URL + 'get-sentence-word-count?basename=' + translation_process_obj.basename).then(function (res) {
                                let data = res.data
                                if (data && data.data) {
                                    axios.post('http://' + process.env.ES_HOSTS + ':9200/doc_report/_update/' + h._id, {
                                        "script": {
                                            "source": "ctx._source.word_count = params.word_count",
                                            "lang": "painless",
                                            "params": {
                                                "word_count": data.data.word_count
                                            }
                                        }
                                    }).then(function (response) {
                                        axios.post('http://' + process.env.ES_HOSTS + ':9200/doc_report/_update/' + h._id, {
                                            "script": {
                                                "source": "ctx._source.sentence_count = params.sentence_count",
                                                "lang": "painless",
                                                "params": {
                                                    "sentence_count": data.data.sentence_count
                                                }
                                            }
                                        }).then(function (response) {
                                            LOG.debug(response.data)
                                            callback()
                                        })
                                    })
                                }
                                else {
                                    callback()
                                }
                            })
                        })

                    } else {
                        LOG.debug('Data not found')
                        callback()
                    }
                })
            }
            else if (!source.word_count || !source.sentence_count) {
                axios.get(PYTHON_URL + 'get-sentence-word-count?basename=' + source.document_id).then(function (res) {
                    let data = res.data
                    if (data && data.data) {
                        axios.post('http://' + process.env.ES_HOSTS + ':9200/doc_report/_update/' + h._id, {
                            "script": {
                                "source": "ctx._source.word_count = params.word_count",
                                "lang": "painless",
                                "params": {
                                    "word_count": data.data.word_count
                                }
                            }
                        }).then(function (response) {
                            axios.post('http://' + process.env.ES_HOSTS + ':9200/doc_report/_update/' + h._id, {
                                "script": {
                                    "source": "ctx._source.sentence_count = params.sentence_count",
                                    "lang": "painless",
                                    "params": {
                                        "sentence_count": data.data.sentence_count
                                    }
                                }
                            }).then(function (response) {
                                LOG.debug(response.data)
                                callback()
                            })
                        })
                    }
                    else {
                        callback()
                    }
                })
            }
            else {
                callback()
            }
        })
    })
    // LOG.debug(translation_process)
    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
    return res.status(response.http.status).json(response);
}

exports.fetchParagraphWorkspaceDetail = function (req, res) {
    if (!req || !req.query || !req.query.session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    LOG.debug('Request came for fetchParagraphWorkspaceDetail [%s]', req.query.session_id)
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

exports.fetchSearchReplaceWorkspace = function (req, res) {
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
    SearchReplaceWorkspace.countDocuments(condition, function (err, count) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        SearchReplaceWorkspace.findByCondition(condition, pagesize, pageno, function (err, models) {
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

exports.updateSearchReplaceSentence = function (req, res) {
    if (!req || !req.body || !req.body.sentence_pair) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let sentence_pair = req.body.sentence_pair
    sentence_pair.viewed = true
    async.waterfall([
        function (waterfall_callback) {
            if ("is_alone" in sentence_pair && !sentence_pair.is_alone) {
                if (sentence_pair.accepted && sentence_pair.changes && Array.isArray(sentence_pair.changes) && sentence_pair.changes.length > 0) {
                    let target = sentence_pair.target
                    let target_change = sentence_pair.changes[0].target_search
                    let target_replace = sentence_pair.changes[0].replace
                    target = target.replace(target_change, target_replace)
                    sentence_pair.updated = target
                    SentencePair.findByCondition({ processId: sentence_pair.processId, hash_: sentence_pair.hash_, serial_no: sentence_pair.serial_no++ }, function (err, result) {
                        if (result && Array.isArray(result) && result.length > 0) {
                            let result_obj = result[0]._doc
                            result_obj.target = target
                            SentencePair.updateSentencePair(result_obj, function (err, doc) {
                                if (err) {
                                    LOG.error(err)
                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                                waterfall_callback()
                            })
                        } else {
                            waterfall_callback()
                        }
                    })
                } else {
                    SentencePair.findByCondition({ processId: sentence_pair.processId, hash_: sentence_pair.hash_, serial_no: sentence_pair.serial_no + 1 }, function (err, result) {
                        if (result && Array.isArray(result) && result.length > 0) {
                            async.each(result, function (sentence_pair_doc, callback) {
                                let sentence_pair = sentence_pair_doc._doc
                                sentence_pair.viewed = true
                                SentencePair.updateSentencePair(sentence_pair, function (err, models) {
                                    if (err) {
                                        LOG.error(err)
                                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                        return res.status(apistatus.http.status).json(apistatus);
                                    }
                                    callback()
                                })
                            }, function (err) {
                                waterfall_callback()
                            })
                        } else {
                            waterfall_callback()
                        }
                    })
                }
            } else {
                waterfall_callback()
            }
        }
    ], function () {
        SentencePair.updateSentencePair(sentence_pair, function (err, models) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            SentencePair.countDocuments({ processId: sentence_pair.processId, viewed: { $exists: false } }, function (err, count) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                LOG.debug('Sentence pair remaining for process', count)
                if (count == 0) {
                    SearchReplaceWorkspace.findByCondition({ session_id: sentence_pair.processId }, null, null, function (err, models) {
                        if (err) {
                            LOG.error(err)
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        } else if (!models || models.length == 0) {
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_INVALID_PARAMETERS, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                        models[0]._doc.step = STEP_IN_PROGRESS
                        SearchReplaceWorkspace.updateSearchReplaceWorkspace(models[0]._doc, function (err, doc) {
                            if (err) {
                                LOG.error(err);
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            KafkaProducer.getInstance().getProducer((err, producer) => {
                                if (err) {
                                    LOG.error("Unable to connect to KafkaProducer");
                                } else {
                                    LOG.debug("KafkaProducer connected")
                                    let data = models[0]._doc
                                    data.path = PATH_WRITE_TO_FILE
                                    let payloads = [
                                        {
                                            topic: TOPIC_STAGE_3, messages: JSON.stringify({ data: data, path: PATH_WRITE_TO_FILE }), partition: 0
                                        }
                                    ]
                                    producer.send(payloads, function (err, data) {
                                        LOG.debug('Produced')
                                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                                        return res.status(response.http.status).json(response);
                                    });
                                }
                            })
                        })

                    })
                } else {
                    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                    return res.status(response.http.status).json(response);
                }

            })
        })
    })
}

exports.acceptAllSearchReplaceSentence = function (req, res) {
    if (!req || !req.body || !req.body.processId || !req.body.source_search) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let source_search = req.body.source_search
    let process_id = req.body.processId
    SentencePair.findByCondition({ processId: process_id, viewed: { $exists: false }, 'changes.source_search': source_search }, function (err, models) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        } else if (!models || models.length == 0) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        async.each(models, function (sentence_pair_doc, callback) {
            let sentence_pair = sentence_pair_doc._doc
            sentence_pair.viewed = true
            sentence_pair.accepted = true
            SentencePair.updateSentencePair(sentence_pair, function (err, models) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                callback()
            })
        }, function (err) {
            SentencePair.countDocuments({ processId: process_id, viewed: { $exists: false } }, function (err, count) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                LOG.debug('Sentence pair remaining for process', count)
                if (count == 0) {
                    SearchReplaceWorkspace.findByCondition({ session_id: process_id }, null, null, function (err, models) {
                        if (err) {
                            LOG.error(err)
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        } else if (!models || models.length == 0) {
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_INVALID_PARAMETERS, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                        models[0]._doc.step = STEP_IN_PROGRESS
                        SearchReplaceWorkspace.updateSearchReplaceWorkspace(models[0]._doc, function (err, doc) {
                            if (err) {
                                LOG.error(err);
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            KafkaProducer.getInstance().getProducer((err, producer) => {
                                if (err) {
                                    LOG.error("Unable to connect to KafkaProducer");
                                } else {
                                    LOG.debug("KafkaProducer connected")
                                    let data = models[0]._doc
                                    data.path = PATH_WRITE_TO_FILE
                                    let payloads = [
                                        {
                                            topic: TOPIC_STAGE_3, messages: JSON.stringify({ data: data, path: PATH_WRITE_TO_FILE }), partition: 0
                                        }
                                    ]
                                    producer.send(payloads, function (err, data) {
                                        let response = new Response(StatusCode.SUCCESS, COMPONENT, count).getRsp()
                                        return res.status(response.http.status).json(response);
                                    });
                                }
                            })
                        })
                    })
                } else {
                    let response = new Response(StatusCode.SUCCESS, COMPONENT, count).getRsp()
                    return res.status(response.http.status).json(response);
                }

            })
        });
    })
}

exports.fetchSearchReplaceSentence = function (req, res) {
    if (!req || !req.query || !req.query.session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let process_id = req.query.session_id
    let condition = { processId: process_id }
    SentencePair.countDocuments(condition, function (err, availablecount) {
        SentencePair.countDocuments({ processId: process_id, viewed: true }, function (err, viewedcount) {
            SentencePair.countDocuments({ processId: process_id, accepted: true }, function (err, acceptedcount) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                SentencePairUnchecked.countDocuments(condition, function (err, count) {
                    if (err) {
                        LOG.error(err)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    SentencePair.findByCondition({ processId: process_id, viewed: { $exists: false } }, function (err, models) {
                        if (err) {
                            LOG.error(err)
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                        if (models && models.length > 0) {
                            let data = models[0]._doc
                            data.total_sentences = count + availablecount
                            data.found_sentences = availablecount - acceptedcount
                            let response = new Response(StatusCode.SUCCESS, data, availablecount - viewedcount).getRsp()
                            return res.status(response.http.status).json(response);
                        } else {
                            let response = new Response(StatusCode.SUCCESS, {}, 0).getRsp()
                            return res.status(response.http.status).json(response);
                        }

                    })
                })
            })
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

exports.fetchCompositionWorkspace = function (req, res) {
    let status = req.query.status
    let step = req.query.step
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
    if (step) {
        condition['step'] = step
    }
    CompositionWorkspace.countDocuments(condition, function (err, count) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        CompositionWorkspace.findByCondition(condition, pagesize, pageno, function (err, models) {
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
        fs.copyFile(BASE_PATH_NGINX + req.body.paragraph_workspace.token_file, BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.body.paragraph_workspace.token_file, function (err) {
            if (err) {
                LOG.error(err)
            } else {
                LOG.debug('File transfered [%s]', req.body.paragraph_workspace.token_file)
            }
        })
        fs.copyFile(BASE_PATH_NGINX + req.body.paragraph_workspace.negative_token_file, BASE_PATH_PIPELINE_1 + workspace._doc.session_id + '/' + req.body.paragraph_workspace.negative_token_file, function (err) {
            if (err) {
                LOG.error(err)
            } else {
                LOG.debug('File transfered [%s]', req.body.paragraph_workspace.negative_token_file)
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
                        LOG.debug("KafkaProducer connected")
                        let payloads = [
                            {
                                topic: TOPIC_STAGE_1_STEP_2, messages: JSON.stringify({ data: workspace._doc }), partition: 0
                            }
                        ]
                        producer.send(payloads, function (err, data) {
                            LOG.debug('Produced')
                        });
                    }
                })
                LOG.debug('Data updated successfully [%s]', JSON.stringify(req.body.paragraph_workspace))
                let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                return res.status(response.http.status).json(response);
            }
        })

    })
}

exports.saveSearchReplaceWorkspace = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.search_replace_workspace || !req.body.search_replace_workspace.selected_mt_workspaces) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let workspace = req.body.search_replace_workspace
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
        fs.mkdir(BASE_PATH_PIPELINE_3 + workspace.session_id, function (e) {
            fs.copyFile(BASE_PATH_NGINX + workspace.config_file_location, BASE_PATH_PIPELINE_3 + workspace.session_id + '/' + workspace.config_file_location, function (err) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                SearchReplaceWorkspace.save([workspace], function (err, models) {
                    if (err) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    async.each(req.body.search_replace_workspace.selected_mt_workspaces, function (selected_workspace, callback) {
                        workspace.selected_files.push(selected_workspace.sentence_file)
                        fs.copyFile(BASE_PATH_PIPELINE_2 + selected_workspace.session_id + '/' + selected_workspace.sentence_file, BASE_PATH_PIPELINE_3 + workspace.session_id + '/' + selected_workspace.sentence_file, function (err) {
                            if (err) {
                                LOG.error(err)
                            } else {
                                LOG.debug('File transfered [%s]', selected_workspace.sentence_file)
                            }
                            KafkaProducer.getInstance().getProducer((err, producer) => {
                                if (err) {
                                    LOG.error("Unable to connect to KafkaProducer");
                                } else {
                                    LOG.debug("KafkaProducer connected")
                                    let payloads = [
                                        {
                                            topic: TOPIC_STAGE_3, messages: JSON.stringify({ data: workspace, path: PATH_SEARCH_REPLACE }), partition: 0
                                        }
                                    ]
                                    producer.send(payloads, function (err, data) {
                                        LOG.debug('Produced')
                                    });
                                }
                            })
                            callback()
                        })

                    }, function (err) {
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    });
                })
            })
        })
    })
}

exports.saveCompositionWorkspace = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.composition_workspace || !req.body.composition_workspace.search_replace_workspaces) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let workspace = req.body.composition_workspace
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
        fs.mkdir(BASE_PATH_PIPELINE_4 + workspace.session_id, function (e) {
            fs.copyFile(BASE_PATH_NGINX + workspace.config_file_location, BASE_PATH_PIPELINE_4 + workspace.session_id + '/' + workspace.config_file_location, function (err) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                CompositionWorkspace.save([workspace], function (err, models) {
                    if (err) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    async.each(req.body.composition_workspace.search_replace_workspaces, function (selected_workspace, callback) {
                        workspace.selected_files.push(selected_workspace.sentence_file)
                        fs.copyFile(BASE_PATH_PIPELINE_3 + selected_workspace.session_id + '/' + selected_workspace.sentence_file, BASE_PATH_PIPELINE_4 + workspace.session_id + '/' + selected_workspace.sentence_file, function (err) {
                            if (err) {
                                LOG.error(err)
                            } else {
                                LOG.debug('File transfered [%s]', selected_workspace.sentence_file)
                            }
                            KafkaProducer.getInstance().getProducer((err, producer) => {
                                if (err) {
                                    LOG.error("Unable to connect to KafkaProducer");
                                } else {
                                    LOG.debug("KafkaProducer connected")
                                    let payloads = [
                                        {
                                            topic: TOPIC_STAGE_4, messages: JSON.stringify({ data: workspace, path: PATH_FILE_MERGER }), partition: 0
                                        }
                                    ]
                                    LOG.debug(payloads)
                                    producer.send(payloads, function (err, data) {
                                        if(err){
                                            LOG.error(err)
                                        }
                                        LOG.debug('Produced')
                                    });
                                }
                            })
                            callback()
                        })

                    }, function (err) {
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    });
                })
            })
        })
    })
}

exports.saveParagraphWorkspaceData = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.paragraph_workspace || !req.body.paragraph_workspace.title || !req.body.paragraph_workspace.sentence_file) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let workspace = req.body.paragraph_workspace
    workspace.session_id = UUIDV4()
    workspace.status = STATUS_PROCESSED
    workspace.step = STEP_SENTENCE
    workspace.created_at = new Date()
    axios.get(USER_INFO_URL + '/' + userId).then((api_res) => {
        workspace.created_by = userId
        if (api_res.data) {
            workspace.username = api_res.data.username
        }
        let file_name = workspace.title + workspace.session_id + '.csv'
        fs.mkdir(BASE_PATH_PIPELINE_1 + workspace.session_id, function (e) {
            if (e) {
                LOG.error(e)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            fs.copyFile(BASE_PATH_NGINX + workspace.sentence_file, BASE_PATH_PIPELINE_1 + workspace.session_id + '/' + file_name, function (err) {
                if (e) {
                    LOG.error(e)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                fs.copyFile(BASE_PATH_NGINX + workspace.sentence_file, BASE_PATH_NGINX + file_name, function (err) {

                    if (e) {
                        LOG.error(e)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    CSVReader.countSentence(BASE_PATH_NGINX + file_name, function (rowCount) {
                        workspace.sentence_file = file_name
                        workspace.sentence_count = rowCount
                        ParagraphWorkspace.save([workspace], function (err, models) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                            return res.status(response.http.status).json(response);
                        })
                    })
                })
            })
        })
    })
}

exports.saveMTWorkspaceData = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.mt_workspace || !req.body.mt_workspace.title || !req.body.mt_workspace.target_language || !req.body.mt_workspace.sentence_file) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let workspace = req.body.mt_workspace
    let source_lang = req.body.mt_workspace.source_language
    let target_lang = req.body.mt_workspace.target_language
    workspace.session_id = UUIDV4()
    workspace.source_language = source_lang.language_code
    workspace.target_language = target_lang.language_code
    workspace.status = STATUS_PROCESSED
    workspace.step = STEP_COMPLETED
    workspace.created_at = new Date()
    axios.get(USER_INFO_URL + '/' + userId).then((api_res) => {
        workspace.created_by = userId
        if (api_res.data) {
            workspace.username = api_res.data.username
        }
        let file_name = workspace.title + workspace.session_id + '.csv'
        fs.mkdir(BASE_PATH_PIPELINE_2 + workspace.session_id, function (e) {
            if (e) {
                LOG.error(e)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            fs.copyFile(BASE_PATH_NGINX + workspace.sentence_file, BASE_PATH_PIPELINE_2 + workspace.session_id + '/' + file_name, function (err) {
                if (e) {
                    LOG.error(e)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                fs.copyFile(BASE_PATH_NGINX + workspace.sentence_file, BASE_PATH_NGINX + file_name, function (err) {
                    if (e) {
                        LOG.error(e)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    CSVReader.countSentence(BASE_PATH_NGINX + file_name, function (rowCount) {
                        workspace.sentence_file = file_name
                        workspace.sentence_count = rowCount
                        MTWorkspace.save([workspace], function (err, models) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                            return res.status(response.http.status).json(response);
                        })
                    })
                })
            })
        })
    })
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
                            LOG.debug('File transfered [%s]', selected_workspace.sentence_file)
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
                            LOG.debug("KafkaProducer connected")
                            workspace.use_latest = false
                            let payloads = [
                                {
                                    topic: TOPIC_STAGE_2, messages: JSON.stringify({ data: workspace }), partition: 0
                                }
                            ]
                            LOG.debug('Sending req', { session_id: workspace.session_id, files: workspace.selected_files, target_language: workspace.target_language })
                            axios.post(CORPUS_REPORT_URL, { session_id: workspace.session_id, files: workspace.selected_files, target_language: workspace.target_language }, { headers: { 'content-type': 'application/json' } }).then((api_res) => {
                                LOG.debug('Response receive for mt report')
                                LOG.debug(api_res.data)
                                if (api_res && api_res.data && api_res.data.ok) {
                                    LOG.debug(api_res.data.data)
                                    MTWorkspace.findByCondition({ session_id: workspace.session_id }, null, null, function (err, docs) {
                                        if (docs && docs.length > 0) {
                                            let workspacedb = docs[0]._doc
                                            workspacedb.report = api_res.data.data
                                            MTWorkspace.updateMTWorkspace(workspacedb, function (err, doc) {
                                                if (err) {
                                                    LOG.error(err)
                                                }
                                                else {
                                                    LOG.debug(doc)
                                                }
                                            })
                                        }
                                    })
                                }
                            }).catch((e) => {
                                LOG.error('Unable to fetch reports for mt workspace [%s]', JSON.stringify(workspace))
                                LOG.error(e)
                            })
                            LOG.debug('Sending message', payloads)
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
        fs.copyFile(BASE_PATH_NGINX + workspace.config_file_location, BASE_PATH_PIPELINE_1 + workspace.session_id + '/' + workspace.config_file_location, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            else {
                fs.copyFile(BASE_PATH_NGINX + workspace.paragraph_file_location, BASE_PATH_PIPELINE_1 + workspace.session_id + '/' + workspace.paragraph_file_location, function (err) {
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
                                        LOG.debug("KafkaProducer connected")
                                        let payloads = [
                                            {
                                                topic: TOPIC_STAGE_1, messages: JSON.stringify({ data: data }), partition: 0
                                            }
                                        ]
                                        producer.send(payloads, function (err, data) {
                                            LOG.debug('Produced')
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