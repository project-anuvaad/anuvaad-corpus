var BaseModel = require('../models/basemodel');
var PdfParser = require('../models/pdf_parser');
var PdfDocProcess = require('../models/pdf_to_doc_process');
var PdfSentence = require('../models/pdf_sentences');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger

var KafkaTopics = require('../config/kafka-topics').KafkTopics
var PdfToHtml = require('../utils/pdf_to_html')
var KafkaProducer = require('../kafka/producer');
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

const NER_FIRST_PAGE_IDENTIFIERS = {
    'REPORTABLE_TYPE': { align: 'CENTER', is_new_line: true, is_bold: true },
    'JURISDICTION': { align: 'CENTER', is_new_line: true },
    'FORUM_NAME': { align: 'CENTER', is_new_line: true, is_bold: true },
    'FIRST_PARTY': { align: 'LEFT' },
    'FIRST_PARTY_TYPE': { align: 'RIGHT', is_new_line: true },
    'SECOND_PARTY': { align: 'LEFT' },
    'SECOND_PARTY_TYPE': { align: 'RIGHT', is_new_line: true },
    'WITH_HEADER': { align: 'CENTER', is_new_line: true },
    'CASE_IDENTIFIER': { align: 'CENTER', is_new_line: true },
    'SLP': { align: 'CENTER', is_new_line: true },
    'JUDGMENT_ORDER_HEADER': { align: 'CENTER', is_new_line: true, is_bold: true },
    'JUDGE_NAME': { align: 'LEFT', is_new_line: true, is_bold: true, underline: true },
}

const NER_LAST_PAGE_IDENTIFIERS = {
    'JUDGMENT_JUDGE_SIGNATURE': { align: 'RIGHT', is_new_line: true },
    'JUDGE_NAME': { align: 'RIGHT', is_new_line: true },
    'JUDGMENT_LOCATION': { align: 'LEFT', is_new_line: true },
    'JUDGMENT_DATE': { align: 'LEFT', is_new_line: true },
}


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
                processHtml(pdf_parser_process, index, output_res, true, 1, false, null, res)
            })
        })
    })
}

function makeSentenceObjForNer(n, identifier_tag, ner_sentences, page_no) {
    let sentence = {}
    Object.assign(sentence, identifier_tag)
    sentence.text = n.tagged_value
    sentence.is_ner = true
    sentence.page_no = page_no
    ner_sentences.push(sentence)
    return ner_sentences
}

function useNerTags(ner_data, data, cb) {
    let JUDGMENT_ORDER_HEADER_PAGE_NO = -1
    let JUDGE_NAME_PAGE_NO = -1
    let JUDGMENT_ORDER_HEADER = ''
    let JUDGE_NAME = ''
    let JUDGMENT_ORDER_HEADER_FOUND = false
    let LAST_PAGE_NER_BEGINNING = ''
    let LAST_PAGE_NER_BEGINNING_FOUND = false
    let ner_sentences = []
    let last_page_ner_sentences = []
    ner_data.map((ner, index) => {
        if ((JUDGMENT_ORDER_HEADER.length == 0 && JUDGMENT_ORDER_HEADER_PAGE_NO >= index) || (JUDGE_NAME.length == 0)) {
            ner_run_arr = []
            tab_stops = []
            ner.map((n) => {
                if (Object.keys(NER_FIRST_PAGE_IDENTIFIERS).indexOf(n.annotation_tag) >= 0) {
                    if (n.annotation_tag === 'JUDGE_NAME' && !(JUDGMENT_ORDER_HEADER_PAGE_NO >= 0 && index + 1 - JUDGMENT_ORDER_HEADER_PAGE_NO <= 1)) {
                        return
                    }
                    let identifier_tag = NER_FIRST_PAGE_IDENTIFIERS[n.annotation_tag]
                    ner_sentences = makeSentenceObjForNer(n, identifier_tag, ner_sentences, data[0].page_no)
                }
                if (n.annotation_tag === 'JUDGMENT_ORDER_HEADER') {
                    JUDGMENT_ORDER_HEADER_PAGE_NO = index + 1
                    JUDGMENT_ORDER_HEADER = n.tagged_value
                }
                else if (n.annotation_tag === 'JUDGE_NAME' && JUDGMENT_ORDER_HEADER_PAGE_NO >= 0 && index + 1 - JUDGMENT_ORDER_HEADER_PAGE_NO <= 1) {
                    JUDGE_NAME_PAGE_NO = index + 1
                    JUDGE_NAME = n.tagged_value
                }
            })
        }
        else {
            return
        }
    })
    let last_page_ner = ner_data[ner_data.length - 1]
    last_page_ner.map((n) => {
        if (Object.keys(NER_LAST_PAGE_IDENTIFIERS).indexOf(n.annotation_tag) >= 0) {
            if (LAST_PAGE_NER_BEGINNING.length == 0) {
                LAST_PAGE_NER_BEGINNING = n.tagged_value
            }
            if (n.annotation_tag == 'JUDGMENT_DATE') {
                let ner_obj = { annotation_tag: 'JUDGMENT_LOCATION', tagged_value: 'New Delhi' }
                let identifier_tag = NER_LAST_PAGE_IDENTIFIERS[ner_obj.annotation_tag]
                last_page_ner_sentences = makeSentenceObjForNer(ner_obj, identifier_tag, last_page_ner_sentences, data[data.length - 1].page_no)
            }
            let identifier_tag = NER_LAST_PAGE_IDENTIFIERS[n.annotation_tag]
            last_page_ner_sentences = makeSentenceObjForNer(n, identifier_tag, last_page_ner_sentences, data[data.length - 1].page_no)
        }
    })
    let sentences = ner_sentences
    data.map((d, index) => {
        let remaining_text = ''
        //For handling last page related ner
        if (d.page_no >= ner_data.length && !LAST_PAGE_NER_BEGINNING_FOUND) {
            if (d.text.indexOf(LAST_PAGE_NER_BEGINNING) >= 0) {
                LAST_PAGE_NER_BEGINNING_FOUND = true
                return
            }
        }
        if (LAST_PAGE_NER_BEGINNING_FOUND) {
            return true
        }
        //For handling first page related ner
        if (((JUDGE_NAME_PAGE_NO >= 0 && d.page_no <= JUDGE_NAME_PAGE_NO) || (JUDGE_NAME_PAGE_NO === -1 && d.page_no <= JUDGMENT_ORDER_HEADER_PAGE_NO)) && !JUDGMENT_ORDER_HEADER_FOUND) {
            if (JUDGE_NAME.length > 0 && d.text.indexOf(JUDGE_NAME) >= 0) {
                remaining_text = d.text.replace(JUDGE_NAME, '')
                JUDGMENT_ORDER_HEADER_FOUND = true
            }
            else if (JUDGE_NAME.length == 0 && d.text.indexOf(JUDGMENT_ORDER_HEADER) >= 0) {
                remaining_text = d.text.replace(JUDGMENT_ORDER_HEADER, '')
                JUDGMENT_ORDER_HEADER_FOUND = true
            }
            if (remaining_text.trim().length < 1)
                return
        }
        sentences.push(d)
    })
    sentences = sentences.concat(last_page_ner_sentences)
    cb(sentences)
}

function performNer(data, cb) {
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
            cb(null, api_res)
        } else {
            cb('err', null)
        }
    }).catch((e) => {
        cb(e, null)
    })
}

function makeSenteceObj(text, sentence_index, node_index) {
    let sentence = {}
    sentence.text = text
    sentence.sentence_index = sentence_index
    sentence.src = text
    sentence.n_id = node_index
    sentence.s_id = sentence_index
    return sentence
}

function processHtml(pdf_parser_process, index, output_res, merge, start_node_index, tokenize, translate, model, res) {
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
                processHtml(pdf_parser_process, index, output_res, merge, start_node_index, tokenize, translate, model, res)
            })
        })
    } else {
        if (merge) {
            let sentences = []
            Object.keys(output_res).forEach(function (key, index) {
                if (output_res[key + '']['html_nodes'] && output_res[key + '']['html_nodes'].length > 0)
                    sentences.push(output_res[key + '']['html_nodes'][0].text)
            })
            axios.post(PYTHON_BASE_URL + 'ner',
                {
                    sentences: sentences
                }
            ).then(function (api_res) {
                if (api_res && api_res.data && api_res.data.data) {
                    api_res.data.data.map((d, index) => {
                        output_res[(index + 1) + '']['ner'] = d
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
            HtmlToText.mergeHtmlNodes(output_res, function (err, data, header_text, footer_text) {
                performNer(data, function (err, ner_data) {
                    if (err) {
                        LOG.error(err)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    useNerTags(ner_data.data.data, data, function (data) {
                        if (tokenize) {
                            axios.post(PYTHON_BASE_URL + 'tokenize-sentence',
                                {
                                    paragraphs: data
                                }
                            ).then(function (api_res) {
                                let sentences = []
                                if (api_res && api_res.data) {
                                    KafkaProducer.getInstance().getProducer((err, producer) => {
                                        if (err) {
                                            LOG.error("Unable to connect to KafkaProducer");
                                        } else {
                                            LOG.debug("KafkaProducer connected")
                                        }
                                        let index = 0
                                        async.each(api_res.data.data, (d, cb) => {
                                            let sentence_index = 0
                                            let tokenized_sentences = []
                                            if (data[index].is_table) {
                                                for (var key in data[index].table_items) {
                                                    for (var itemkey in data[index].table_items[key]) {
                                                        let node_data = data[index].table_items[key][itemkey]
                                                        tokenized_sentences.push(makeSenteceObj(node_data.text, sentence_index, data[index].node_index, pdf_parser_process.session_id, model))
                                                        sentence_index++
                                                    }
                                                }
                                            } else {
                                                d.text.map(function (tokenized_sentence) {
                                                    tokenized_sentences.push(makeSenteceObj(tokenized_sentence, sentence_index, data[index].node_index, pdf_parser_process.session_id, model))
                                                    sentence_index++
                                                })
                                            }
                                            if (translate && model && producer) {
                                                let payloads = [
                                                    {
                                                        topic: KafkaTopics.NMT_TRANSLATE, messages: JSON.stringify({ 'url_end_point': model.url_end_point, 'message': tokenized_sentences }), partition: 0
                                                    }
                                                ]
                                                producer.send(payloads, function (err, data) {
                                                    LOG.debug('Produced')
                                                });
                                            }
                                            data[index].status = STATUS_PENDING
                                            data[index].session_id = pdf_parser_process.session_id
                                            data[index].tokenized_sentences = tokenized_sentences
                                            index++
                                            cb()
                                        }, function (err) {
                                            LOG.info('Saving pdf sentences')
                                            BaseModel.saveData(PdfSentence, data, function (err, doc) {
                                                if (err) {
                                                    LOG.error(err)
                                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                                    return res.status(apistatus.http.status).json(apistatus);
                                                } else {
                                                    LOG.info('Saving pdf obj')
                                                    BaseModel.saveData(PdfParser, [pdf_parser_process], function (err, doc) {
                                                        if (err) {
                                                            LOG.error(err)
                                                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                                            return res.status(apistatus.http.status).json(apistatus);
                                                        } else {
                                                            let response = new Response(StatusCode.SUCCESS, doc).getRsp()
                                                            return res.status(response.http.status).json(response);
                                                        }
                                                    })
                                                }
                                            })
                                        })
                                    })
                                }
                            })

                        } else {
                            let response = new Response(StatusCode.SUCCESS, data, null, null, null, ner_data.data.data).getRsp()
                            return res.status(response.http.status).json(response);
                        }
                    })
                })
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
                processHtml(pdf_parser_process, index, output_res, false, 1, false, false, null, res)
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
            PdfToHtml.convertPdfToHtmlPagewise(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let index = 1
                let output_res = {}
                processHtml(pdf_parser_process, index, output_res, false, 1, true, false, null, res)
            })
        })
    })
}

exports.translatePdf = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.process_name || !req.files || !req.body.model || !req.files.pdf_data) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let model = JSON.parse(req.body.model)
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
                processHtml(pdf_parser_process, index, output_res, false, 1, true, true, model, res)
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