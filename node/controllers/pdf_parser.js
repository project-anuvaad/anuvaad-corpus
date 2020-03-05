var BaseModel = require('../models/basemodel');
var PdfParser = require('../models/pdf_parser');
var PdfSentence = require('../models/pdf_sentences');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger

var PdfToHtml = require('../utils/pdf_to_html')
var HtmlToText = require('../utils/html_to_text')
var UUIDV4 = require('uuid/v4')
var fs = require('fs');
var axios = require('axios');
var async = require('async')

const PYTHON_BASE_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/corpus/'


var COMPONENT = "pdf_parser";
const BASE_PATH_NGINX = 'nginx/'
const BASE_PATH_UPLOAD = 'corpusfiles/'
const STATUS_PROCESSING = 'PROCESSING'
const STATUS_COMPLETED = 'COMPLETED'
const STATUS_PENDING = 'PENDING'

exports.extractParagraphs = function (req, res) {
    if (!req || !req.body || !req.files || !req.files.pdf_data) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let file = req.files.pdf_data
    let pdf_parser_process = {}
    pdf_parser_process.session_id = UUIDV4()
    pdf_parser_process.pdf_path = file.name
    fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
        fs.writeFile(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, file.data, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }

            PdfToHtml.convertPdfToHtml(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                HtmlToText.convertHtmlToJson(BASE_PATH_UPLOAD, 'output-html.html', pdf_parser_process.session_id, function (err, data) {
                    let response = new Response(StatusCode.SUCCESS, data).getRsp()
                    return res.status(response.http.status).json(response);

                })
            })
        })
    })
}

exports.savePdfParserProcess = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.process_name || !req.files || !req.files.pdf_data) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let file = req.files.pdf_data
    let pdf_parser_process = {}
    pdf_parser_process.session_id = UUIDV4()
    pdf_parser_process.process_name = req.body.process_name
    pdf_parser_process.pdf_path = file.name
    pdf_parser_process.status = STATUS_COMPLETED
    pdf_parser_process.created_by = userId
    pdf_parser_process.created_on = new Date()
    fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
        fs.writeFile(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, file.data, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }

            PdfToHtml.convertPdfToHtml(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                HtmlToText.convertHtmlToJson(BASE_PATH_UPLOAD, 'output-html.html', pdf_parser_process.session_id, function (err, data) {
                    let paragraphs = []
                    data.map((d) => {
                        paragraphs.push(d.text)
                    })
                    axios.post(PYTHON_BASE_URL + 'tokenize-sentence',
                        {
                            paragraphs: paragraphs
                        }
                    ).then(function (api_res) {
                        let sentences = []
                        if (api_res && api_res.data) {
                            let index = 0
                            let sentence_index = 0
                            async.each(api_res.data.data, (d, cb) => {
                                data[index].text = d
                                async.each(d, function (text, callback) {
                                    let sentence = {}
                                    sentence.text = text
                                    sentence.sentence_index = sentence_index
                                    sentence.session_id = pdf_parser_process.session_id
                                    sentence.status = STATUS_PENDING
                                    sentences.push(sentence)
                                    sentence_index++
                                    callback()
                                }, function (err) {
                                    index++
                                    cb()
                                })
                            }, function (err) {
                                BaseModel.saveData(PdfSentence, sentences, function (err, doc) {
                                    BaseModel.saveData(PdfParser, [pdf_parser_process], function (err, doc) {
                                        if (err) {
                                            LOG.error(err)
                                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                            return res.status(apistatus.http.status).json(apistatus);
                                        }
                                        let response = new Response(StatusCode.SUCCESS, doc).getRsp()
                                        return res.status(response.http.status).json(response);
                                    })
                                })
                            })
                        }
                    })

                })
            })
        })
    })
}

exports.fetchPdfParserProcess = function (req, res) {
    let status = req.query.status
    let userId = req.headers['ad-userid']
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    let condition = {}
    if (status) {
        condition = { status: status, created_by: userId }
    }
    PdfParser.countDocuments(condition, function (err, count) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        BaseModel.findByCondition(PdfParser, condition, pagesize, pageno, null, function (err, models) {
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


exports.fetchPdfSentences = function (req, res) {
    let status = req.query.status
    let session_id = req.query.session_id
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    let condition = {}
    if (status) {
        condition = { status: status }
    }
    if (session_id) {
        condition['session_id'] = session_id
    }
    PdfSentence.countDocuments(condition, function (err, count) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        BaseModel.findByCondition(PdfSentence, condition, pagesize, pageno, 'sentence_index', function (err, models) {
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

exports.updatePdfSentences = function (req, res) {

}