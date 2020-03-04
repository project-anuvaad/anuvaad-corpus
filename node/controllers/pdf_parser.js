var BaseModel = require('../models/basemodel');
var PdfParser = require('../models/pdf_parser');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger

var PdfToHtml = require('../utils/pdf_to_html')
var HtmlToText = require('../utils/html_to_text')
var UUIDV4 = require('uuid/v4')
var fs = require('fs');
var axios = require('axios');

const PYTHON_BASE_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/corpus/'


var COMPONENT = "pdf_parser";
const BASE_PATH_NGINX = 'nginx/'
const BASE_PATH_UPLOAD = 'corpusfiles/'
const STATUS_PROCESSING = 'PROCESSING'


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
    pdf_parser_process.status = STATUS_PROCESSING
    pdf_parser_process.created_by = userId
    pdf_parser_process.created_on = new Date()
    fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
        fs.writeFile(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, file.data, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            BaseModel.saveData(PdfParser, [pdf_parser_process], function (err, data) {
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
                        axios.post(PYTHON_BASE_URL+'tokenize-sentence',
                            {
                                paragraphs: paragraphs
                            }
                        ).then(function (res) {
                            LOG.debug(res)
                            if (res && res.data) {
                                res.data.data.map((d, index) => {
                                    data[index].text = d
                                })
                                let response = new Response(StatusCode.SUCCESS, data).getRsp()
                                return res.status(response.http.status).json(response);
                            }
                        })

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
        BaseModel.findByCondition(PdfParser, condition, pagesize, pageno, function (err, models) {
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