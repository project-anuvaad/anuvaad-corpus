var BaseModel = require('../models/basemodel');
var PdfParser = require('../models/pdf_parser');
var PdfSentence = require('../models/pdf_sentences');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger

var PdfToHtml = require('../utils/pdf_to_html')
var HtmlToText = require('../utils/html_to_text')
var DocxCreator = require('../utils/docx-creator')
var UUIDV4 = require('uuid/v4')
var fs = require('fs');
var axios = require('axios');
var async = require('async')
var docx4js = require("docx4js").Document;

const PYTHON_BASE_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/corpus/'


var COMPONENT = "doc_parser";
const BASE_PATH_NGINX = 'nginx/'
const BASE_PATH_UPLOAD = 'upload/'
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
    DocxCreator.covertJsonToDoc((req.body.doc_data), function () {
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    })
}