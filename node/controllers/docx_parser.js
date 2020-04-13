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
var DocxCreator = require('../utils/docx-creator')
var UUIDV4 = require('uuid/v4')
var fs = require('fs');
var axios = require('axios');
var async = require('async')
var docx4js = require("docx4js").Document;

const PYTHON_BASE_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'http://auth.anuvaad.org/'


var COMPONENT = "doc_parser";
const BASE_PATH_NGINX = 'nginx/'
const BASE_PATH_UPLOAD = 'corpusfiles/pdfs/'
const STATUS_PROCESSING = 'PROCESSING'
const STATUS_COMPLETED = 'COMPLETED'
const STATUS_PENDING = 'PENDING'

exports.extractDocx = function (req, res) {
    if (!req || !req.body || !req.files || !req.files.doc_file) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let file = req.files.doc_file
    let pdf_parser_process = {}
    pdf_parser_process.session_id = UUIDV4()
    pdf_parser_process.doc_file = file.name
    fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
        fs.writeFile(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.doc_file, file.data, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            docx4js.load(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.doc_file).then(docx => {
                let data = []
                docx.officeDocument.content("w\\:r").map((node) => {
                    if (docx.officeDocument.content("w\\:r")[node].children) {
                        docx.officeDocument.content("w\\:r")[node].children.map((c) => {
                            if (c.name === 'w:t') {
                                c.children.map((child) => {
                                    if (child.type === 'text') {
                                        data.push(child.data)
                                    }
                                })
                            }
                        })
                    }
                })
                let response = new Response(StatusCode.SUCCESS, data).getRsp()
                return res.status(response.http.status).json(response);

            }).catch(e => {
                LOG.error(e)
                let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                return res.status(response.http.status).json(response);
            })
        })
    })
}


exports.makeDoc = function (req, res) {
    if (!req || !req.body || !req.body.doc_data) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    DocxCreator.covertJsonToDoc(req.body.doc_data, req.body.ner, BASE_PATH_NGINX, function () {
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    })
}


exports.convertPdfToDoc = function (req, res) {
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
        HtmlToText.mergeHtmlNodes(output_res, function (err, data, footer_text) {
            let sentences = []
            let previous_page_no = -1
            let page_sentences = ''
            data.map((d, index) => {
                if (previous_page_no !== d.page_no) {
                    previous_page_no = d.page_no
                    if (page_sentences.length > 0) {
                        sentences.push(page_sentences)
                    }
                    page_sentences = d.text
                } else {
                    page_sentences += ' ' + d.text
                }
            })
            if (page_sentences.length > 0) {
                sentences.push(page_sentences)
            }
            axios.post(PYTHON_BASE_URL + 'ner',
                {
                    sentences: sentences
                }
            ).then(function (api_res) {
                if (api_res && api_res.data && api_res.data.data) {
                    DocxCreator.covertJsonToDoc(data, api_res.data.data, BASE_PATH_NGINX,footer_text, function (err, filepath) {
                        if (err) {
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                        let response = new Response(StatusCode.SUCCESS, filepath).getRsp()
                        return res.status(response.http.status).json(response);
                    })
                }
            }).catch((e) => {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            })
        })
    }
}