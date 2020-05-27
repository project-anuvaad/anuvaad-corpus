var LOG = require('./logger/logger').logger

var PdfToHtml = require('./utils/pdf_to_html')
var HtmlToText = require('./utils/html_to_text')
var UUIDV4 = require('uuid/v4')
var fs = require('fs');
var axios = require('axios');
var async = require('async')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;


const PYTHON_BASE_URL = 'http://gateway_python:5001/'


var COMPONENT = "pdf_parser";
const BASE_PATH_NGINX = 'nginx/'
const BASE_PATH_UPLOAD = 'corpusfiles/'
const STATUS_PROCESSING = 'PROCESSING'
const STATUS_COMPLETED = 'COMPLETED'
const STATUS_PENDING = 'PENDING'

function processHtml(pdf_parser_process, index, output_res, merge, start_node_index, tokenize, filename, callback) {
    if (fs.existsSync(BASE_PATH_UPLOAD + pdf_parser_process.session_id + "/" + 'output-' + index + '.html')) {
        HtmlToText.convertHtmlToJsonPagewise(BASE_PATH_UPLOAD, 'output-' + index + '.html', pdf_parser_process.session_id, merge, index, start_node_index, function (err, data) {
            output_res[index + ''] = data
            index += 1
            start_node_index += data.length
            processHtml(pdf_parser_process, index, output_res, merge, start_node_index, tokenize, filename, callback)
        })
    } else {
        if (merge) {
            callback()
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
                                let csvWriter = createCsvWriter({
                                    path: BASE_PATH_UPLOAD + 'pdfs/' + filename.split('.pdf')[0] + '.csv',
                                    header: [
                                        { id: 'text', title: 'Text' },
                                        { id: 'page_no', title: 'Page No' }
                                    ]
                                });
                                csvWriter.writeRecords(sentences)       // returns a promise
                                    .then(() => {
                                        callback()
                                    });
                                LOG.info(sentences)
                                
                            })
                        }
                    })
                } else {
                    callback()
                }
            })
        }
    }
}


function savePdfParserProcess() {
    fs.readdir(BASE_PATH_UPLOAD + 'pdfs', function (err, files) {
        //handling error
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }
        async.each(files, function (filename, cb) {
            LOG.info(filename)
            let pdf_parser_process = {}
            pdf_parser_process.session_id = UUIDV4()
            pdf_parser_process.pdf_path = filename
            pdf_parser_process.status = STATUS_COMPLETED
            pdf_parser_process.created_on = new Date()
            fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
                fs.copyFile(BASE_PATH_UPLOAD + 'pdfs/' + filename, BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, function (err) {
                    if (err) {
                        LOG.error(err)
                        cb()
                    }
                    PdfToHtml.convertPdfToHtmlPagewise(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
                        if (err) {
                            LOG.error(err)
                            cb()
                        }
                        let index = 1
                        let output_res = {}
                        processHtml(pdf_parser_process, index, output_res, false, 1, true, filename, cb)
                    })
                })
            })
        }, function (err) {
            LOG.info('Process completed')
        })
    })
}



savePdfParserProcess()

