var BaseModel = require('../models/basemodel');
var PdfParser = require('../models/pdf_parser');
var PdfSentence = require('../models/pdf_sentences');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger

var PdfToHtml = require('../utils/pdf_to_html')
var HtmlToText = require('../utils/html_to_text')
var ImageProcessing = require('../utils/image_processing')
var UUIDV4 = require('uuid/v4')
var fs = require('fs');
var axios = require('axios');
var async = require('async')

const PYTHON_BASE_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'http://auth.anuvaad.org/'


var COMPONENT = "pdf_parser";
const BASE_PATH_NGINX = 'nginx/'
const BASE_PATH_UPLOAD = 'corpusfiles/pdfs/'
const STATUS_PROCESSING = 'PROCESSING'
const STATUS_COMPLETED = 'COMPLETED'
const STATUS_PENDING = 'PENDING'


exports.extractParagraphsPerPages = function (req, res) {
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

            PdfToHtml.convertPdfToHtmlPagewise(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let index = 1
                let output_res = {}
                processHtml(pdf_parser_process, index, output_res, true, 1, false, res)
            })
        })
    })
}

function processHtml(pdf_parser_process, index, output_res, merge, start_node_index, tokenize, res) {
    if (fs.existsSync(BASE_PATH_UPLOAD + pdf_parser_process.session_id + "/" + 'output-' + index + '.html')) {
        let image_index = index
        if ((index + '').length == 1) {
            image_index = '00' + index
        } else if ((index + '').length == 2) {
            image_index = '0' + index
        }
        ImageProcessing.processImage(BASE_PATH_UPLOAD + '/' + pdf_parser_process.session_id + '/output' + image_index + '.png', function (err, image_data) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            HtmlToText.convertHtmlToJsonPagewise(BASE_PATH_UPLOAD, 'output-' + index + '.html', pdf_parser_process.session_id, merge, index, start_node_index, function (err, data) {
                output_res[index + ''] = { html_nodes: data, image_data: image_data }
                index += 1
                start_node_index += data.length
                processHtml(pdf_parser_process, index, output_res, merge, start_node_index, tokenize, res)
            })
        })
    } else {
        if (merge) {
            let sentences = []
            Object.keys(output_res).forEach(function (key, index) {
                sentences.push(output_res[key+'']['html_nodes'][0].text)
            })
            axios.post(PYTHON_BASE_URL + 'ner',
                {
                    sentences: sentences
                }
            ).then(function (api_res) {
                if (api_res && api_res.data && api_res.data.data) {
                    api_res.data.data.map((d, index) => {
                        output_res[(index+1)+'']['ner'] = d
                    })
                    let response = new Response(StatusCode.SUCCESS, output_res).getRsp()
                    return res.status(response.http.status).json(response);
                }
            }).catch((e) => {
                LOG.error(e)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            })
        } else {
            HtmlToText.mergeHtmlNodes(output_res, function (err, data) {
                if (tokenize) {
                    axios.post(PYTHON_BASE_URL + 'tokenize-sentence',
                        {
                            paragraphs: data
                        }
                    ).then(function (api_res) {
                        let sentences = []
                        if (api_res && api_res.data) {
                            let index = 0
                            let sentence_index = 0
                            async.each(api_res.data.data, (d, cb) => {
                                data[index].text = d
                                async.each(d.text, function (tokenized_sentence, callback) {
                                    let sentence = {}
                                    sentence.text = tokenized_sentence
                                    sentence.page_no = d.page_no
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
                } else {
                    let sentences = []
                    data.map((d) => {
                        sentences.push(d.text)
                    })
                    axios.post(PYTHON_BASE_URL + 'ner',
                        {
                            sentences: sentences
                        }
                    ).then(function (api_res) {
                        if (api_res && api_res.data && api_res.data.data) {
                            api_res.data.data.map((d, index) => {
                                data[index]['ner'] = d
                            })
                            let response = new Response(StatusCode.SUCCESS, data).getRsp()
                            return res.status(response.http.status).json(response);
                        }
                    }).catch((e) => {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    })
                }
            })
        }
    }
}

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

            PdfToHtml.convertPdfToHtmlPagewise(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let index = 1
                let output_res = {}
                processHtml(pdf_parser_process, index, output_res, false, 1, false, res)
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
            PdfToHtml.convertPdfToHtmlPagewise(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let index = 1
                let output_res = {}
                processHtml(pdf_parser_process, index, output_res, false, 1, true, res)
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