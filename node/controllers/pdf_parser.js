var BaseModel = require('../models/basemodel');
var PdfParser = require('../models/pdf_parser');
var PdfDocProcess = require('../models/pdf_to_doc_process');
var SentencesRedis = require('../models/sentences_redis');
var PdfSentence = require('../models/pdf_sentences');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger

var KafkaTopics = require('../config/kafka-topics').KafkTopics
var PdfToHtml = require('../utils/pdf_to_html')
var TranslateAnuvaad = require('../utils/translate_anuvaad')
var PdfToText = require('../utils/pdf_to_json')
var KafkaProducer = require('../kafka/producer');
var HtmlToText = require('../utils/html_to_text')
var PdfJsonToText = require('../utils/pdf_json_to_text')
var ImageProcessing = require('../utils/image_processing')
var UUIDV4 = require('uuid/v4')
var fs = require('fs');
var axios = require('axios');
var async_lib = require('async')
var DocxCreator = require('../utils/docx-creator')

const PYTHON_BASE_URL = process.env.PYTHON_URL ? process.env.PYTHON_URL : 'https://auth.anuvaad.org/'
const NER_BASE_URL = process.env.NER_BASE_URL ? process.env.NER_BASE_URL : 'https://auth.anuvaad.org/'


var COMPONENT = "pdf_parser";
const BASE_PATH_NGINX = 'nginx/'
const BASE_PATH_UPLOAD = 'corpusfiles/pdfs/'
const ETL_UPLOAD = 'upload/'
const STATUS_PROCESSING = 'PROCESSING'
const STATUS_COMPLETED = 'COMPLETED'
const STATUS_TRANSLATING = 'TRANSLATING'
const STATUS_TRANSLATED = 'TRANSLATED'
const STATUS_PENDING = 'PENDING'
const STATUS_DELETED = 'DELETED'
const TOKENIZED_HINDI_ENDPOINT = 'tokenize-hindi-sentence'
const NER_END_POINT = 'v0/ner'
const TOKENIZED_ENDPOINT = 'tokenize-sentence'

const AVERAGE_TRANSLATION_TIME = 5

const NER_FIRST_PAGE_IDENTIFIERS = {
    'REPORTABLE_TYPE': { align: 'RIGHT', is_new_line: true, is_bold: true },
    'JURISDICTION': { align: 'CENTER', is_new_line: true },
    'FORUM_NAME': { align: 'CENTER', is_new_line: true, is_bold: true },
    'FIRST_PARTY': { align: 'LEFT' },
    'FIRST_PARTY_TYPE': { align: 'RIGHT', is_new_line: true },
    'VERSUS': { align: 'CENTER', is_new_line: true },
    'SECOND_PARTY': { align: 'LEFT' },
    'SECOND_PARTY_TYPE': { align: 'RIGHT', is_new_line: true },
    'AND_IN_WITH_HEADER': { align: 'CENTER', is_new_line: true },
    'CASE_IDENTIFIER': { align: 'CENTER', is_new_line: true },
    'SLP': { align: 'CENTER', is_new_line: true },
    'JUDGMENT_ORDER_HEADER': { align: 'CENTER', is_new_line: true, is_bold: true },
    'J_AUTHOR_JUDGE': { align: 'LEFT', is_new_line: true, is_bold: true, underline: true },
}

const NER_LAST_PAGE_IDENTIFIERS = {
    'J_JUDGMENT_JUDGE_SIGNATURE': { align: 'RIGHT', is_new_line: true },
    'JUDGE_NAME': { align: 'RIGHT', is_new_line: true },
    'JUDGMENT_LOCATION': { align: 'LEFT', is_new_line: true },
    'J_JUDGMENT_DATE': { align: 'LEFT', is_new_line: true },
}

function saveTranslatedText(sentence, cb) {
    let n_id = sentence['n_id']
    let condition = { node_index: n_id.split('__')[0], session_id: n_id.split('__')[1] }
    BaseModel.findByCondition(PdfSentence, condition, null, null, null, function (err, data) {
        if (err || !data || data.length == 0) {
            LOG.error('Sentence not found', sentence)
            cb()
        }
        else {
            let sentencedb = data[0]._doc
            if (sentencedb.is_footer) {
                let splitted_arr = sentencedb.text.split(' ')
                if (splitted_arr && splitted_arr.length > 0) {
                    let first_text = splitted_arr[0]
                    if (!isNaN(first_text)) {
                        sentence['tgt'] = first_text + ' ' + sentence['tgt']
                    }
                }
            }
            else if (sentencedb.is_table) {
                let table_items = sentencedb.table_items
                let query_param = {}
                for (var key in table_items) {
                    for (var itemkey in table_items[key]) {
                        let node_data = table_items[key][itemkey]
                        if (node_data.sentence_index == sentence['s_id']) {
                            let query_key = 'table_items.' + key + '.' + itemkey + ''
                            query_param = { status: STATUS_TRANSLATED, [query_key + '.target']: sentence['tgt'], [query_key + '.tagged_src']: sentence['tagged_src'], [query_key + '.tagged_tgt']: sentence['tagged_tgt'] }
                        }
                    }
                }
                BaseModel.updateData(PdfSentence, query_param, sentencedb._id, function (err, data) {
                    LOG.info('Data updated for table', sentence)
                })
            }
            let tokenized_sentences = sentencedb.tokenized_sentences
            let query_param = {}
            let data_available = false
            tokenized_sentences.map((tokenized_sentence, index) => {
                if (tokenized_sentence.sentence_index == sentence['s_id']) {
                    let query_key = 'tokenized_sentences.' + index
                    query_param = { status: STATUS_TRANSLATED, [query_key + '.target']: sentence['tgt'], [query_key + '.tagged_src']: sentence['tagged_src'], [query_key + '.tagged_tgt']: sentence['tagged_tgt'] }
                    data_available = true
                }
            })
            if (data_available) {
                BaseModel.updateData(PdfSentence, query_param, sentencedb._id, function (err, data) {
                    BaseModel.findByCondition(PdfSentence, { session_id: sentencedb.session_id, status: { $ne: STATUS_DELETED } }, null, null, null, function (err, doc) {
                        let data_completed = true
                        if (!err && doc && doc.length > 0) {
                            doc.map((data) => {
                                if (data._doc.tokenized_sentences) {
                                    data._doc.tokenized_sentences.map((sentence) => {
                                        if (!("target" in sentence)) {
                                            data_completed = false
                                        }
                                    })
                                }
                            })
                            if (data_completed) {
                                BaseModel.findByCondition(PdfParser, { session_id: sentencedb.session_id }, null, null, null, function (err, pdf_process) {
                                    if (pdf_process) {
                                        let pdf_obj = pdf_process[0]._doc
                                        BaseModel.updateData(PdfParser, { status: STATUS_COMPLETED }, pdf_obj._id, function (err, doc) {
                                            LOG.info('PDF process completed')
                                        })
                                    }
                                })
                            }
                        }
                    })
                    cb()
                })
            } else {
                cb()
            }
        }
    })
}

exports.processTranslatedText = function (sentences) {
    async_lib.each(sentences, (sentence, cb) => {
        saveTranslatedText(sentence, cb)
    }, function (err) {
        LOG.info('Process completed')
    })
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
                processHtml(pdf_parser_process, index, output_res, true, 1, false, null, null, res, false)
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
    sentence.node_index = UUIDV4()
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
    let ner_not_available = true
    if (ner_data && ner_data.length > 0) {
        ner_data.map((ner, index) => {
            if (ner && ner.length > 0) {
                ner_not_available = false
                if ((JUDGMENT_ORDER_HEADER.length == 0 && JUDGMENT_ORDER_HEADER_PAGE_NO >= index) || (JUDGE_NAME.length == 0)) {
                    ner_run_arr = []
                    tab_stops = []
                    ner.map((n) => {
                        if (Object.keys(NER_FIRST_PAGE_IDENTIFIERS).indexOf(n.annotation_tag) >= 0) {
                            if (n.annotation_tag === 'J_AUTHOR_JUDGE' && !(JUDGMENT_ORDER_HEADER_PAGE_NO >= 0 && index + 1 - JUDGMENT_ORDER_HEADER_PAGE_NO <= 1)) {
                                return
                            }
                            let identifier_tag = NER_FIRST_PAGE_IDENTIFIERS[n.annotation_tag]
                            ner_sentences = makeSentenceObjForNer(n, identifier_tag, ner_sentences, data[0].page_no)
                            if (n.annotation_tag === 'FIRST_PARTY_TYPE') {
                                let identifier_tag = NER_FIRST_PAGE_IDENTIFIERS['VERSUS']
                                ner_sentences = makeSentenceObjForNer({ tagged_value: 'Versus' }, identifier_tag, ner_sentences, data[0].page_no)
                            }
                        }
                        if (n.annotation_tag === 'JUDGMENT_ORDER_HEADER') {
                            JUDGMENT_ORDER_HEADER_PAGE_NO = index + 1
                            JUDGMENT_ORDER_HEADER = n.tagged_value
                        }
                        else if (n.annotation_tag === 'J_AUTHOR_JUDGE' && JUDGMENT_ORDER_HEADER_PAGE_NO >= 0 && index + 1 - JUDGMENT_ORDER_HEADER_PAGE_NO <= 1) {
                            JUDGE_NAME_PAGE_NO = index + 1
                            JUDGE_NAME = n.tagged_value
                        }
                    })
                }
                else {
                    return
                }
            }
        })
        let last_page_ner = ner_data[ner_data.length - 1]
        let judgment_location_obj = []
        if (ner_data.length > 1) {
            let previous_last_page_ner = ner_data[ner_data.length - 2]
            if (previous_last_page_ner && previous_last_page_ner.length > 0) {
                previous_last_page_ner.map((n) => {
                    if (Object.keys(NER_LAST_PAGE_IDENTIFIERS).indexOf(n.annotation_tag) >= 0) {
                        if (LAST_PAGE_NER_BEGINNING.length == 0) {
                            LAST_PAGE_NER_BEGINNING = n.tagged_value
                        }
                        if (n.annotation_tag == 'J_JUDGMENT_DATE') {
                            let ner_obj = { annotation_tag: 'JUDGMENT_LOCATION', tagged_value: 'New Delhi' }
                            let identifier_tag = NER_LAST_PAGE_IDENTIFIERS[ner_obj.annotation_tag]
                            judgment_location_obj = makeSentenceObjForNer(ner_obj, identifier_tag, judgment_location_obj, data[data.length - 1].page_no)
                            judgment_location_obj = makeSentenceObjForNer(n, NER_LAST_PAGE_IDENTIFIERS[n.annotation_tag], judgment_location_obj, data[data.length - 1].page_no)
                        } else {
                            let identifier_tag = NER_LAST_PAGE_IDENTIFIERS[n.annotation_tag]
                            last_page_ner_sentences = makeSentenceObjForNer(n, identifier_tag, last_page_ner_sentences, data[data.length - 1].page_no)
                        }
                    }
                })
            }
        }
        if (last_page_ner && last_page_ner.length > 0) {
            last_page_ner.map((n) => {
                if (Object.keys(NER_LAST_PAGE_IDENTIFIERS).indexOf(n.annotation_tag) >= 0) {
                    if (LAST_PAGE_NER_BEGINNING.length == 0) {
                        LAST_PAGE_NER_BEGINNING = n.tagged_value
                    }
                    if (n.annotation_tag == 'J_JUDGMENT_DATE') {
                        let ner_obj = { annotation_tag: 'JUDGMENT_LOCATION', tagged_value: 'New Delhi' }
                        let identifier_tag = NER_LAST_PAGE_IDENTIFIERS[ner_obj.annotation_tag]
                        judgment_location_obj = makeSentenceObjForNer(ner_obj, identifier_tag, judgment_location_obj, data[data.length - 1].page_no)
                        judgment_location_obj = makeSentenceObjForNer(n, NER_LAST_PAGE_IDENTIFIERS[n.annotation_tag], judgment_location_obj, data[data.length - 1].page_no)
                    } else {
                        let identifier_tag = NER_LAST_PAGE_IDENTIFIERS[n.annotation_tag]
                        last_page_ner_sentences = makeSentenceObjForNer(n, identifier_tag, last_page_ner_sentences, data[data.length - 1].page_no)
                    }
                }
            })
        }
        last_page_ner_sentences = last_page_ner_sentences.concat(judgment_location_obj)
    }
    let sentences = ner_sentences
    data.map((d, index) => {
        let remaining_text = []
        let remaining_text_str = ''
        //For handling last page related ner
        if (ner_data && ner_data.length > 0 && !ner_not_available) {
            if (d.page_no >= ner_data.length - 1 && !LAST_PAGE_NER_BEGINNING_FOUND) {
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
                    if (d.text.trim() != JUDGE_NAME) {
                        remaining_text = d.text.split(JUDGE_NAME)
                        if (remaining_text.length > 0) {
                            d.text = remaining_text[1]
                            remaining_text_str = remaining_text[1]
                        }
                    }
                    JUDGMENT_ORDER_HEADER_FOUND = true
                }
                else if (JUDGE_NAME.length == 0 && d.text.indexOf(JUDGMENT_ORDER_HEADER) >= 0) {
                    remaining_text = d.text.split(JUDGMENT_ORDER_HEADER)
                    if (remaining_text.length > 0) {
                        d.text = remaining_text[1]
                        remaining_text_str = remaining_text[1]
                    }
                    JUDGMENT_ORDER_HEADER_FOUND = true
                }
                if (remaining_text_str.length < 1)
                    return
            }
        }
        sentences.push(d)
    })
    sentences = sentences.concat(last_page_ner_sentences)
    cb(sentences)
}

function performNer(data, dont_use_ner, cb) {
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
    } if (dont_use_ner) {
        cb(null, [])
    } else {
        axios.post(NER_BASE_URL + NER_END_POINT,
            {
                sentences: sentences
            }, {
            timeout: 3000000,
        }
        ).then(function (api_res) {
            if (api_res && api_res.data && api_res.data.ner_result) {
                cb(null, api_res)
            } else {
                cb('err', null)
            }
        }).catch((e) => {
            LOG.error(e)
            cb(e, [])
        })
    }
}

function makeSenteceObj(node_data, text, sentence_index, node_index, id, model_id) {
    let sentence = {}
    sentence.text = text
    sentence.sentence_index = sentence_index
    if (node_data.is_footer) {
        let splitted_arr = text.split(' ')
        if (splitted_arr && splitted_arr.length > 0) {
            let first_text = splitted_arr[0]
            if (!isNaN(first_text)) {
                sentence.src = text.substr((text).indexOf(' ') + 1)
            } else {
                sentence.src = text
            }
        }
    } else {
        if (node_data.is_ner) {
            sentence.src = sentenceCase(text)
        } else {
            sentence.src = text
        }
    }
    sentence.id = parseInt(model_id)
    sentence.n_id = node_index + '__' + id
    sentence.s_id = sentence_index
    sentence.version = 0
    return sentence
}

function processHtml(pdf_parser_process, index, output_res, merge, start_node_index, tokenize, translate, model, res, dontsendres, userId, dont_use_ner, send_sentences) {
    if (fs.existsSync(BASE_PATH_UPLOAD + pdf_parser_process.session_id + "/" + 'output-' + index + '.html')) {
        let image_index = index
        if ((index + '').length == 1) {
            image_index = '00' + index
        } else if ((index + '').length == 2) {
            image_index = '0' + index
        }
        ImageProcessing.processImage(BASE_PATH_UPLOAD + '/' + pdf_parser_process.session_id + '/output' + image_index + '.png', 'output' + image_index + '.png', function (err, image_data) {
            if (err) {
                LOG.error(err)
                // let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                // return res.status(apistatus.http.status).json(apistatus);
            }
            HtmlToText.convertHtmlToJsonPagewise(BASE_PATH_UPLOAD, 'output-' + index + '.html', pdf_parser_process.session_id, merge, index, start_node_index, function (err, data) {
                output_res[index + ''] = { html_nodes: data, image_data: image_data }
                index += 1
                start_node_index += data.length
                processHtml(pdf_parser_process, index, output_res, merge, start_node_index, tokenize, translate, model, res, dontsendres, userId, dont_use_ner, send_sentences)
            })
        })
    } else {
        if (merge) {
            let sentences = []
            Object.keys(output_res).forEach(function (key, index) {
                if (output_res[key + '']['html_nodes'] && output_res[key + '']['html_nodes'].length > 0)
                    sentences.push(output_res[key + '']['html_nodes'][0].text)
            })
            axios.post(NER_BASE_URL + NER_END_POINT,
                {
                    sentences: sentences
                }
            ).then(function (api_res) {
                if (api_res && api_res.data && api_res.data.ner_result) {
                    api_res.data.ner_result.map((d, index) => {
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
                performNer(data, dont_use_ner, function (err, ner_data) {
                    // if (err) {
                    //     LOG.error(err)
                    //     let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    //     return res.status(apistatus.http.status).json(apistatus);
                    // }
                    useNerTags(ner_data && ner_data.data && ner_data.data.ner_result && ner_data.data.ner_result.length > 0 ? ner_data.data.ner_result : [], data, function (data) {
                        if (tokenize) {
                            axios.post(PYTHON_BASE_URL + TOKENIZED_ENDPOINT,
                                {
                                    paragraphs: data
                                }
                            ).then(function (api_res) {
                                if (api_res && api_res.data) {
                                    KafkaProducer.getInstance().getProducer((err, producer) => {
                                        if (err) {
                                            LOG.error("Unable to connect to KafkaProducer");
                                        } else {
                                            LOG.debug("KafkaProducer connected")
                                        }
                                        let index = 0
                                        if (send_sentences) {
                                            let sentences = []
                                            api_res.data.data.map(d => {
                                                sentences = sentences.concat(d.text)
                                            })
                                            let response = new Response(StatusCode.SUCCESS, sentences).getRsp()
                                            return res.status(response.http.status).json(response);
                                        }
                                        else {
                                            async_lib.each(api_res.data.data, (d, cb) => {
                                                let sentence_index = 0
                                                let tokenized_sentences = []
                                                const tokenized_node_index = index
                                                if (data[tokenized_node_index].is_table) {
                                                    let tokenized_data = data[tokenized_node_index]
                                                    for (var key in tokenized_data.table_items) {
                                                        for (var itemkey in tokenized_data.table_items[key]) {
                                                            let node_data = tokenized_data.table_items[key][itemkey]
                                                            tokenized_data.table_items[key][itemkey].sentence_index = sentence_index
                                                            tokenized_sentences.push(makeSenteceObj(node_data, node_data.text, sentence_index, tokenized_data.node_index, pdf_parser_process.session_id, model ? model.model_id : null))
                                                            sentence_index++
                                                        }
                                                    }
                                                } else if (data[tokenized_node_index].is_ner || data[tokenized_node_index].is_footer) {
                                                    tokenized_sentences.push(makeSenteceObj(data[tokenized_node_index], data[tokenized_node_index].text, sentence_index, data[tokenized_node_index].node_index, pdf_parser_process.session_id, model ? model.model_id : null))
                                                    sentence_index++
                                                }
                                                else {
                                                    d.text.map(function (tokenized_sentence) {
                                                        tokenized_sentences.push(makeSenteceObj(data[tokenized_node_index], tokenized_sentence, sentence_index, data[tokenized_node_index].node_index, pdf_parser_process.session_id, model ? model.model_id : null))
                                                        sentence_index++
                                                    })
                                                }
                                                index++
                                                if (translate && model && producer) {
                                                    async_lib.waterfall([
                                                        function (callback) {
                                                            if (tokenized_sentences.length > 25) {
                                                                var i, j, temparray, chunk = 25;
                                                                for (i = 0, j = tokenized_sentences.length; i < j; i += chunk) {
                                                                    temparray = tokenized_sentences.slice(i, i + chunk);
                                                                    temparray.filter(sent => !sent.target)
                                                                    let payloads = [
                                                                        {
                                                                            topic: KafkaTopics.NMT_TRANSLATE, messages: JSON.stringify({ 'url_end_point': model.url_end_point, 'message': temparray }), partition: 0
                                                                        }
                                                                    ]
                                                                    producer.send(payloads, function (err, data) {
                                                                        LOG.debug('Produced')
                                                                    });
                                                                }
                                                                callback()
                                                            } else {
                                                                let kafka_sentences = []
                                                                let tokenized_sentences_index = 0
                                                                async_lib.each(tokenized_sentences, (sentence, rediscb) => {
                                                                    SentencesRedis.fetchSentence(sentence, userId + '_' + pdf_parser_process.target_lang, function (err, doc) {
                                                                        if (doc) {
                                                                            let saved_sentence = JSON.parse(doc)
                                                                            if (saved_sentence.target && saved_sentence.target.length > 0 && saved_sentence.target.trim().length > 0) {
                                                                                LOG.info('Sentence found from redis', saved_sentence)
                                                                                tokenized_sentences[tokenized_sentences_index].target = saved_sentence['target']
                                                                                tokenized_sentences[tokenized_sentences_index].status = STATUS_TRANSLATED
                                                                                tokenized_sentences[tokenized_sentences_index].tagged_src = saved_sentence.tagged_src
                                                                                tokenized_sentences[tokenized_sentences_index].tagged_tgt = saved_sentence.tagged_tgt
                                                                                if (data[tokenized_node_index].is_table) {
                                                                                    let tokenized_data = data[tokenized_node_index]
                                                                                    for (var key in tokenized_data.table_items) {
                                                                                        for (var itemkey in tokenized_data.table_items[key]) {
                                                                                            let node_data = tokenized_data.table_items[key][itemkey]
                                                                                            if (node_data.sentence_index == sentence.sentence_index) {
                                                                                                data[tokenized_node_index].table_items[key][itemkey].target = saved_sentence['target']
                                                                                                data[tokenized_node_index].table_items[key][itemkey].tagged_src = saved_sentence.tagged_src
                                                                                                data[tokenized_node_index].table_items[key][itemkey].tagged_tgt = saved_sentence.tagged_tgt
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                kafka_sentences.push(sentence)
                                                                            }
                                                                        } else {
                                                                            kafka_sentences.push(sentence)
                                                                        }
                                                                        tokenized_sentences_index++;
                                                                        rediscb()
                                                                    })

                                                                }, function (err) {
                                                                    let payloads = [
                                                                        {
                                                                            topic: KafkaTopics.NMT_TRANSLATE, messages: JSON.stringify({ 'url_end_point': model.url_end_point, 'message': kafka_sentences }), partition: 0
                                                                        }
                                                                    ]
                                                                    producer.send(payloads, function (err, data) {
                                                                        LOG.debug('Produced')
                                                                    });
                                                                    callback()
                                                                })
                                                            }
                                                        }
                                                    ], function () {
                                                        let translated = true
                                                        tokenized_sentences.map((token) => {
                                                            if (!token.target) {
                                                                translated = false
                                                            }
                                                        })
                                                        data[tokenized_node_index].para_index = tokenized_node_index
                                                        data[tokenized_node_index].node_index = data[tokenized_node_index].node_index + ''
                                                        data[tokenized_node_index].version = 0
                                                        data[tokenized_node_index].status = translated ? STATUS_TRANSLATED : STATUS_PENDING
                                                        data[tokenized_node_index].session_id = pdf_parser_process.session_id
                                                        data[tokenized_node_index].tokenized_sentences = tokenized_sentences
                                                        cb()
                                                    })

                                                } else {
                                                    let translated = true
                                                    tokenized_sentences.map((token) => {
                                                        if (!token.target) {
                                                            translated = false
                                                        }
                                                    })
                                                    data[index - 1].node_index = data[index - 1].node_index + ''
                                                    data[index - 1].version = 0
                                                    data[index - 1].para_index = index - 1
                                                    data[index - 1].status = translated ? STATUS_TRANSLATED : STATUS_PENDING
                                                    data[index - 1].session_id = pdf_parser_process.session_id
                                                    data[index - 1].tokenized_sentences = tokenized_sentences
                                                    cb()
                                                }

                                            }, function (err) {
                                                LOG.info('Saving pdf sentences')
                                                if (header_text && header_text.length > 0) {
                                                    data.unshift({ text: header_text, is_header: true, session_id: pdf_parser_process.session_id, status: STATUS_PENDING, tokenized_sentences: [] })
                                                }
                                                if (footer_text && footer_text.length > 0) {
                                                    data.push({ text: footer_text, is_footer_text: true, session_id: pdf_parser_process.session_id, status: STATUS_PENDING, tokenized_sentences: [] })
                                                }
                                                BaseModel.saveData(PdfSentence, data, function (err, doc) {
                                                    if (err) {
                                                        LOG.error(err)
                                                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                                        return res.status(apistatus.http.status).json(apistatus);
                                                    } else {

                                                        if (dontsendres) {
                                                            LOG.info('Updating pdf obj')
                                                            let condition = { session_id: pdf_parser_process.session_id }
                                                            PdfSentence.countDocuments({ status: STATUS_PENDING }, function (err, totalcount) {
                                                                BaseModel.findByCondition(PdfParser, condition, null, null, null, function (err, data) {
                                                                    if (data && data.length > 0) {
                                                                        let pdfobj = data[0]._doc
                                                                        let updateObj = { status: STATUS_TRANSLATING }
                                                                        if (totalcount) {
                                                                            updateObj['eta'] = totalcount * AVERAGE_TRANSLATION_TIME
                                                                        }
                                                                        BaseModel.updateData(PdfParser, updateObj, pdfobj._id, function (err, doc) {
                                                                            if (err) {
                                                                                LOG.error(err)
                                                                            } else {
                                                                                LOG.info('Data updated')
                                                                            }
                                                                        })
                                                                    }
                                                                })
                                                            })
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
                                                    }
                                                })
                                            })
                                        }
                                    })
                                }
                            })

                        } else {
                            let response = new Response(StatusCode.SUCCESS, data, null, null, null, ner_data && ner_data.data && ner_data.data.ner_result && ner_data.data.ner_result.length > 0 ? ner_data.data.ner_result : []).getRsp()
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
    pdf_parser_process.pdf_path = escape(file.name)
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
                processHtml(pdf_parser_process, index, output_res, false, 1, false, false, null, res, false, null, req.body.dont_use_ner)
            })
        })
    })
}


exports.extractPdfParagraphs = function (req, res) {
    if (!req || !req.body || !req.files || !req.files.pdf_data) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let file = req.files.pdf_data
    let pdf_parser_process = {}
    pdf_parser_process.session_id = UUIDV4()
    pdf_parser_process.pdf_path = escape(file.name)
    fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
        fs.writeFile(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, file.data, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }

            PdfToText.converPdfToJson(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, function (err, data) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let previous_height = -1;
                data.map((page_wise) => {
                    page_wise.map((d) => {
                        if (previous_height == -1) {
                            previous_height = d.height
                        } else if (Math.abs(previous_height - d.height) <= 10) {
                            d.height = previous_height
                        }
                        d.node_index = d.pdf_index
                        d.page_no_end = d.page_no
                        d.class_style = { 'font-size': d.height + 'px', 'font-family': 'Times' }
                        previous_height = d.height
                    })

                })
                PdfJsonToText.mergeJsonNodes(data, [], function (err, out, header_text, footer_text) {
                    let response = new Response(StatusCode.SUCCESS, out).getRsp()
                    return res.status(response.http.status).json(response);
                })
            })
        })
    })
}

exports.extractPdfToSentences = function (req, res) {
    if (!req || !req.body || !req.files || !req.files.pdf_data || !req.body.lang) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let file = req.files.pdf_data
    let pdf_parser_process = {}
    pdf_parser_process.session_id = UUIDV4()
    pdf_parser_process.pdf_path = escape(file.name)
    fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
        fs.writeFile(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, file.data, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            if (req.body.lang == 'hi') {
                PdfToText.converPdfToJson(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, function (err, data) {
                    if (err) {
                        LOG.error(err)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    let previous_height = -1;
                    data.map((page_wise) => {
                        page_wise.map((d) => {
                            if (previous_height == -1) {
                                previous_height = d.height
                            } else if (Math.abs(previous_height - d.height) <= 10) {
                                d.height = previous_height
                            }
                            d.node_index = d.pdf_index
                            d.page_no_end = d.page_no
                            d.class_style = { 'font-size': d.height + 'px', 'font-family': 'Times' }
                            previous_height = d.height
                        })

                    })
                    PdfJsonToText.mergeParagraphJsonNodes(data, function (err, out) {
                        axios.post(PYTHON_BASE_URL + TOKENIZED_HINDI_ENDPOINT,
                            {
                                paragraphs: out
                            }
                        ).then(function (api_res) {
                            let sentences = []
                            if (api_res && api_res.data) {
                                api_res.data.data.map((d) => {
                                    sentences = sentences.concat(d.text)
                                })
                            }
                            let response = new Response(StatusCode.SUCCESS, sentences).getRsp()
                            return res.status(response.http.status).json(response);
                        }).catch(e => {
                            LOG.error(e)
                            let response = new Response(StatusCode.SUCCESS, out).getRsp()
                            return res.status(response.http.status).json(response);
                        })

                    })
                })
            } else {
                PdfToHtml.convertPdfToHtmlPagewise(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
                    if (err) {
                        LOG.error(err)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    let index = 1
                    let output_res = {}
                    processHtml(pdf_parser_process, index, output_res, false, 1, true, false, null, res, false, null, true, true)
                })
            }
        })
    })
}

exports.etlMergeNodes = function (req, res) {
    if (!req || !req.body || !req.body.input || !req.body.input.files || !Array.isArray(req.body.input.files) || req.body.input.files.length == 0) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let task_start_time = new Date().getTime();
    let files = req.body.input.files
    let output_files = []
    async_lib.each(files, (file, cb) => {
        let rawdata = fs.readFileSync(ETL_UPLOAD + file.path);
        let data = JSON.parse(rawdata);
        HtmlToText.mergeHtmlNodes(data, function (err, data, header_text, footer_text) {
            let file_name = new Date().getTime() + '_' + UUIDV4() + '.json'
            fs.writeFile(ETL_UPLOAD + file_name, JSON.stringify({ data: data, header_text: header_text, footer_text: footer_text }), function (err) {
                output_files.push({ inputFile: file.path, outputFile: file_name, outputLocale: file.locale, outputType: 'json' })
                cb()
            })
        })
    }, function (err) {
        let output = { jobID: req.body.jobID, state: 'MERGE-PDF-NODES', output: { files: output_files }, status: 'SUCCESS', taskID: 'MergePdfNodes' + new Date().getTime(), workflowCode: req.body.workflowCode, taskStartTime: task_start_time, taskEndTime: new Date().getTime() }
        return res.status(200).json(output);
    })
}

exports.extractPdfToSentencesV2 = function (req, res) {
    if (!req || !req.body || !req.files || !req.files.pdf_data || !req.body.lang) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let file = req.files.pdf_data
    let pdf_parser_process = {}
    pdf_parser_process.session_id = UUIDV4()
    pdf_parser_process.pdf_path = escape(file.name)
    fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
        fs.writeFile(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, file.data, function (err) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            // if (req.body.lang == 'hi') {
            PdfToText.converPdfToJsonV2(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, function (err, data) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let previous_height = -1;
                data.map((page_wise) => {
                    page_wise.line_data.map((d) => {
                        if (previous_height == -1) {
                            previous_height = d.height
                        } else if (Math.abs(previous_height - d.height) <= 5) {
                            d.height = previous_height
                        }
                        d.node_index = d.pdf_index
                        d.page_no_end = d.page_no
                        d.class_style = { 'font-size': d.height + 'px', 'font-family': 'Times' }
                        previous_height = d.height
                    })

                })
                PdfJsonToText.mergeParagraphJsonNodesV2(data, function (err, out) {
                    // axios.post(PYTHON_BASE_URL + (req.body.lang == 'hi' ? TOKENIZED_HINDI_ENDPOINT : TOKENIZED_ENDPOINT),
                    //     {
                    //         paragraphs: out
                    //     }
                    // ).then(function (api_res) {
                    //     let sentences = []
                    //     if (api_res && api_res.data) {
                    //         api_res.data.data.map((d) => {
                    //             sentences = sentences.concat(d.text)
                    //         })
                    //     }
                    //     let response = new Response(StatusCode.SUCCESS, sentences).getRsp()
                    //     return res.status(response.http.status).json(response);
                    // }).catch(e => {
                    LOG.error(e)
                    let response = new Response(StatusCode.SUCCESS, out).getRsp()
                    return res.status(response.http.status).json(response);
                    // })

                })
            })
            // } else {
            //     PdfToHtml.convertPdfToHtmlPagewise(BASE_PATH_UPLOAD, pdf_parser_process.pdf_path, 'output.html', pdf_parser_process.session_id, function (err, data) {
            //         if (err) {
            //             LOG.error(err)
            //             let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            //             return res.status(apistatus.http.status).json(apistatus);
            //         }
            //         let index = 1
            //         let output_res = {}
            //         processHtml(pdf_parser_process, index, output_res, false, 1, true, false, null, res, false, null, true, true)
            //     })
            // }
        })
    })
}

exports.updatePdfSourceSentences = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.sentence || !req.body.update_sentence) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let sentence = req.body.sentence
    let update_sentence = req.body.update_sentence
    HtmlToText.convertHtmlTextToJson(update_sentence.src, function (err, output) {
        if (output.text) {
            update_sentence.text = output.text
            update_sentence.src = output.text
            update_sentence.underline = output.underline
            update_sentence.is_bold = output.is_bold
        }
        BaseModel.findByCondition(PdfParser, { session_id: sentence.session_id, created_by: userId }, null, null, null, function (err, doc) {
            if (doc && doc.length > 0) {
                let pdf_parser = doc[0]._doc
                let updated_tokenized_sentences = []
                let sentence_to_be_translated = {}
                let sentence_to_be_translated_index = -1
                sentence.tokenized_sentences.map((tokenized_sentence, index) => {
                    if (tokenized_sentence.s_id == update_sentence.s_id) {
                        sentence_to_be_translated_index = index
                        updated_tokenized_sentences.push(update_sentence)
                        sentence_to_be_translated = update_sentence
                    }
                    else {
                        updated_tokenized_sentences.push(tokenized_sentence)
                    }
                })
                if (sentence_to_be_translated_index != -1) {
                    TranslateAnuvaad.translateFromAnuvaad([sentence_to_be_translated], pdf_parser.model ? pdf_parser.model.url_end_point : null, function (err, translation) {
                        if (err) {
                            LOG.error(err)
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                        else {
                            let translated_sentence = translation[0]
                            let sentence_before_translation = updated_tokenized_sentences[sentence_to_be_translated_index]
                            sentence_before_translation.tagged_src = translated_sentence.tagged_src
                            sentence_before_translation.tagged_tgt = translated_sentence.tagged_tgt
                            sentence_before_translation.target = translated_sentence.tgt
                            updated_tokenized_sentences[sentence_to_be_translated_index] = sentence_before_translation
                            if (sentence.is_table) {
                                if (sentence.table_items) {
                                    for (var row in sentence.table_items) {
                                        for (var col in sentence.table_items[row]) {
                                            if (sentence.table_items[row][col].sentence_index == update_sentence.s_id) {
                                                let sentence_before_translation = sentence.table_items[row][col]
                                                sentence_before_translation.tagged_src = translated_sentence.tagged_src
                                                sentence_before_translation.text = translated_sentence.src
                                                sentence_before_translation.tagged_tgt = translated_sentence.tagged_tgt
                                                sentence_before_translation.target = translated_sentence.tgt
                                                sentence.table_items[row][col] = sentence_before_translation
                                                break
                                            }
                                        }
                                    }
                                }
                                BaseModel.updateData(PdfSentence, { text_pending: false, tokenized_sentences: updated_tokenized_sentences, table_items: sentence.table_items }, sentence._id, function (err, data) {
                                    LOG.info('Data updated', sentence)
                                    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                                    return res.status(response.http.status).json(response);
                                })
                            } else {
                                BaseModel.updateData(PdfSentence, { text_pending: false, tokenized_sentences: updated_tokenized_sentences }, sentence._id, function (err, data) {
                                    LOG.info('Data updated', sentence)
                                    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                                    return res.status(response.http.status).json(response);
                                })
                            }

                        }
                    })
                } else {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
            } else {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
        })
    })
}

exports.deleteSentence = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.sentence || !req.body.sentences_delete || !Array.isArray(req.body.sentences_delete)) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let sentence = req.body.sentence
    let sentences_delete = req.body.sentences_delete
    BaseModel.findByCondition(PdfParser, { session_id: sentence.session_id, created_by: userId }, null, null, null, function (err, doc) {
        if (doc && doc.length > 0) {
            let condition = {}
            condition['_id'] = mongoose.Types.ObjectId(sentence._id)
            BaseModel.findByCondition(PdfSentence, condition, null, null, null, function (err, sentences) {
                if (sentences && sentences.length > 0) {
                    let sentence_obj = sentences[0]._doc
                    let tokenized_data = []
                    sentence_obj.tokenized_sentences.map((t) => {
                        sentences_delete.map((s) => {
                            if (t.s_id == s.s_id) {
                                t.status = STATUS_DELETED
                            }
                        })
                        tokenized_data.push(t)
                    })
                    BaseModel.updateData(PdfSentence, { tokenized_sentences: tokenized_data }, sentence._id, function (err, data) {
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    })
                } else {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
            })
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    })
}

exports.deleteTableSentence = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.sentence || !req.body.table_cell || !req.body.operation_type) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let sentence = req.body.sentence
    let table_cell = req.body.table_cell
    let operation_type = req.body.operation_type
    BaseModel.findByCondition(PdfParser, { session_id: sentence.session_id, created_by: userId }, null, null, null, function (err, doc) {
        if (doc && doc.length > 0) {
            let condition = {}
            condition['_id'] = mongoose.Types.ObjectId(sentence._id)
            BaseModel.findByCondition(PdfSentence, condition, null, null, null, function (err, sentences) {
                if (sentences && sentences.length > 0) {
                    let sentence_obj = sentences[0]._doc
                    let tokenized_data = []
                    let sids = []
                    if (operation_type == 'delete-row') {
                        if (sentence_obj.table_items[table_cell.table_row]) {
                            for (var col in sentence_obj.table_items[table_cell.table_row]) {
                                let cell = sentence_obj.table_items[table_cell.table_row][col]
                                sids.push(cell.sentence_index)
                                sentence_obj.table_items[table_cell.table_row][col].status = STATUS_DELETED
                            }
                        }

                    } else if (operation_type == 'delete-column') {
                        for (var row in sentence_obj.table_items) {
                            for (var col in sentence_obj.table_items[row]) {
                                if (col == table_cell.table_column) {
                                    let cell = sentence_obj.table_items[row][col]
                                    sids.push(cell.sentence_index)
                                    sentence_obj.table_items[row][col].status = STATUS_DELETED
                                }
                            }
                        }
                    } else {
                        for (var row in sentence_obj.table_items) {
                            for (var col in sentence_obj.table_items[row]) {
                                let cell = sentence_obj.table_items[row][col]
                                sids.push(cell.sentence_index)
                                sentence_obj.table_items[row][col].status = STATUS_DELETED
                            }
                        }
                    }
                    sentence_obj.tokenized_sentences.map((t) => {
                        if (sids.indexOf(t.s_id) >= 0) {
                            t.status = STATUS_DELETED
                        }
                        tokenized_data.push(t)
                    })
                    BaseModel.updateData(PdfSentence, { tokenized_sentences: tokenized_data, table_items: sentence_obj.table_items }, sentence._id, function (err, data) {
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    })
                } else {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
            })
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    })
}

exports.addSentenceNode = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.sen_node || !(req.body.previous_node || req.body.next_node)) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let sen_node = req.body.sen_node
    let previous_node = req.body.previous_node
    let next_node = req.body.next_node
    BaseModel.findByCondition(PdfParser, { session_id: next_node ? next_node.session_id : previous_node.session_id, created_by: userId }, null, null, null, function (err, doc) {
        if (doc && doc.length > 0) {
            let model = doc[0]._doc.model
            BaseModel.findByCondition(PdfSentence, { session_id: next_node ? next_node.session_id : previous_node.session_id }, null, null, 'para_index', function (err, sentences) {
                if (sentences && sentences.length > 0) {
                    let para_index = 0;
                    async_lib.each(sentences, (sentence, cb) => {
                        let sentencedb = sentence._doc
                        if (next_node && sentencedb._id == next_node._id) {
                            let node_to_be_saved = getObjFromNode(sen_node, next_node, para_index, model)
                            para_index++
                            const para_index_to_be_saved = para_index
                            BaseModel.saveData(PdfSentence, [node_to_be_saved], function (err, doc) {
                                BaseModel.updateData(PdfSentence, { para_index: para_index_to_be_saved }, sentence._doc._id, function (err, data) {
                                    if (err) {
                                        LOG.error(err)
                                    }
                                    cb()
                                })
                            })
                        } else if (!next_node && previous_node && sentencedb._id == previous_node._id) {
                            let node_to_be_saved = getObjFromNode(sen_node, previous_node, para_index + 1, model)
                            para_index++
                            const para_index_to_be_saved = para_index
                            BaseModel.updateData(PdfSentence, { para_index: para_index_to_be_saved - 1 }, sentence._doc._id, function (err, data) {
                                BaseModel.saveData(PdfSentence, [node_to_be_saved], function (err, doc) {
                                    if (err) {
                                        LOG.error(err)
                                    } else {
                                        LOG.info('Data Saved', node_to_be_saved)
                                    }
                                    cb()
                                })
                            })
                        } else {
                            BaseModel.updateData(PdfSentence, { para_index: para_index }, sentence._doc._id, function (err, data) {
                                if (err) {
                                    LOG.error(err)
                                }
                                cb()
                            })
                        }
                        para_index++
                    }, function (err) {
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    })
                }
            })
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    })
}

function getObjFromNode(sen_node, prev_next_node, para_index, model) {
    let node_to_be_saved = {}
    node_to_be_saved.page_no = prev_next_node.page_no
    node_to_be_saved.page_no_end = prev_next_node.page_no_end
    node_to_be_saved.class_style = prev_next_node.class_style
    node_to_be_saved.status = STATUS_TRANSLATED
    node_to_be_saved.session_id = prev_next_node.session_id
    node_to_be_saved.node_index = UUIDV4()
    node_to_be_saved.para_index = para_index
    node_to_be_saved.text_pending = true
    node_to_be_saved.text = ""
    let tokenized_sentences = []
    if (sen_node.type == 'table') {
        node_to_be_saved.is_table = true
        node_to_be_saved.table_items = {}
        let sentence_index = 0
        for (var i = 0; i < sen_node.row_count; i++) {
            node_to_be_saved.table_items[i] = {}
            for (var t = 0; t < sen_node.column_count; t++) {
                let cell_obj = { table_column: t, table_row: i, page_no: node_to_be_saved.page_no, id: parseInt(model.model_id), src: "", text: "", target: "", tagged_src: "", tagged_tgt: "", s_id: sentence_index, sentence_index: sentence_index, n_id: node_to_be_saved.node_index + '__' + node_to_be_saved.session_id }
                node_to_be_saved.table_items[i][t] = cell_obj
                tokenized_sentences.push(cell_obj)
                sentence_index++
            }
        }
        node_to_be_saved.tokenized_sentences = tokenized_sentences
    } else {
        let cell_obj = { page_no: node_to_be_saved.page_no, src: " ", text: " ", id: parseInt(model.model_id), target: " ", tagged_src: " ", tagged_tgt: " ", s_id: 0, sentence_index: 0, n_id: node_to_be_saved.node_index + '__' + node_to_be_saved.session_id }
        tokenized_sentences.push(cell_obj)
        node_to_be_saved.tokenized_sentences = tokenized_sentences
    }

    return node_to_be_saved
}

exports.updatePdfSourceTable = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.sentence || !req.body.operation_type) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let sentence = req.body.sentence
    let operation_type = req.body.operation_type
    BaseModel.findByCondition(PdfParser, { session_id: sentence.session_id, created_by: userId }, null, null, null, function (err, doc) {
        if (doc && doc.length > 0) {
            let pdf_parser = doc[0]._doc
            let updated_tokenized_sentences = []
            let row_count = -1
            let sentence_index = -1
            let tokenized_node_index = -1
            let tokenized_sentences = sentence.tokenized_sentences
            for (var row in sentence.table_items) {
                row_count++
                let column_count = -1
                for (var column in sentence.table_items[row]) {
                    tokenized_node_index++
                    column_count = column;
                    sentence_index++
                    sentence.table_items[row][column].sentence_index = sentence_index
                    tokenized_sentences[tokenized_node_index].s_id = sentence_index
                    tokenized_sentences[tokenized_node_index].sentence_index = sentence_index
                    updated_tokenized_sentences.push(tokenized_sentences[tokenized_node_index])
                }
                if (operation_type == 'add-column') {
                    sentence_index++
                    column_count = parseInt(column_count)
                    sentence.table_items[row][column_count + 1] = Object.assign({}, sentence.table_items[row][column_count])
                    sentence.table_items[row][column_count + 1].sentence_index = sentence_index
                    sentence.table_items[row][column_count + 1].text = ''
                    sentence.table_items[row][column_count + 1].target = ''
                    sentence.table_items[row][column_count + 1].tagged_src = ''
                    sentence.table_items[row][column_count + 1].tagged_tgt = ''
                    sentence.table_items[row][column_count + 1].table_column = column_count + 1
                    let tokenized_sentence = Object.assign({}, tokenized_sentences[tokenized_node_index])
                    tokenized_sentence.sentence_index = sentence_index
                    tokenized_sentence.s_id = sentence_index
                    tokenized_sentence.text = ''
                    tokenized_sentence.src = ''
                    tokenized_sentence.target = ''
                    tokenized_sentence.tagged_src = ''
                    tokenized_sentence.tagged_tgt = ''
                    tokenized_sentence.table_column = column_count + 1
                    updated_tokenized_sentences.push(tokenized_sentence)
                }
            }
            if (operation_type == 'add-row') {
                let new_row = {}
                let row = parseInt(row_count) + 1
                for (var col in sentence.table_items[row_count]) {
                    sentence_index++
                    let column = Object.assign({}, sentence.table_items[row_count][col])
                    column.sentence_index = sentence_index
                    column.text = ''
                    column.target = ''
                    column.tagged_src = ''
                    column.tagged_tgt = ''
                    column.table_row = row
                    new_row[col] = column
                    let tokenized_sentence = Object.assign({}, tokenized_sentences[tokenized_node_index])
                    tokenized_sentence.sentence_index = sentence_index
                    tokenized_sentence.s_id = sentence_index
                    tokenized_sentence.text = ''
                    tokenized_sentence.src = ''
                    tokenized_sentence.target = ''
                    tokenized_sentence.tagged_src = ''
                    tokenized_sentence.tagged_tgt = ''
                    tokenized_sentence.table_column = parseInt(col)
                    tokenized_sentence.table_row = parseInt(row)
                    updated_tokenized_sentences.push(tokenized_sentence)
                }
                sentence.table_items[row_count + 1] = new_row
            }
            BaseModel.updateData(PdfSentence, { tokenized_sentences: updated_tokenized_sentences, table_items: sentence.table_items }, sentence._id, function (err, data) {
                LOG.info('Data updated', sentence)
                let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                return res.status(response.http.status).json(response);
            })


        } else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    })
}

exports.mergeSplitSentence = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.sentences || !req.body.operation_type || !req.body.start_sentence) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let sentences = req.body.sentences
    BaseModel.findByCondition(PdfParser, { session_id: sentences[0].session_id, created_by: userId }, null, null, null, function (err, doc) {
        if (doc && doc.length > 0) {
            let pdf_parser = doc[0]._doc
            if (req.body.operation_type === 'merge') {
                if (!req.body.end_sentence) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                if (sentences.length == 1) {
                    handleSameParaMergeReq(sentences, req.body.start_sentence, req.body.end_sentence, pdf_parser, res)
                } else {
                    handleMultiParaMergeReq(sentences, req.body.start_sentence, req.body.end_sentence, pdf_parser, res)
                }
            } else if (req.body.operation_type === 'merge-individual') {
                if (!req.body.end_sentence) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                if (sentences.length == 1) {
                    handleSameParaMergeIndReq(sentences, req.body.start_sentence, req.body.end_sentence, pdf_parser, res)
                } else {
                    handleMultiParaMergeIndReq(sentences, req.body.start_sentence, req.body.end_sentence, pdf_parser, res)
                }
            } else {
                if (!req.body.selected_text) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                handleSentenceSplitReq(sentences, req.body.start_sentence, req.body.selected_text, pdf_parser, res)
            }
        } else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    })

}

function handleSentenceSplitReq(sentences, start_sentence, selected_text, pdf_parser, res) {
    let sentence = sentences[0]
    let updated_tokenized_sentences = []
    let sentence_to_be_translated = []
    let sentence_to_be_translated_index = -1
    let sentence_index = 0
    sentence.tokenized_sentences.map((tokenized_sentence, index) => {
        if (tokenized_sentence.s_id == start_sentence.s_id) {
            if (selected_text.length == tokenized_sentence.text.length) {
                LOG.info('Nothing to update', tokenized_sentence)
                let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                return res.status(response.http.status).json(response);
            }
            sentence_to_be_translated_index = index
            let remaining_text = tokenized_sentence.text.substr(selected_text.length)
            let remaining_text_node = Object.assign({}, tokenized_sentence)
            tokenized_sentence.text = selected_text.trim()
            tokenized_sentence.src = selected_text.trim()
            tokenized_sentence.sentence_index = sentence_index
            sentence_index++
            remaining_text_node.text = remaining_text.trim()
            remaining_text_node.src = remaining_text.trim()
            remaining_text_node.sentence_index = sentence_index
            sentence_index++
            remaining_text_node.s_id = UUIDV4()
            updated_tokenized_sentences.push(tokenized_sentence)
            updated_tokenized_sentences.push(remaining_text_node)
            sentence_to_be_translated.push(tokenized_sentence)
            sentence_to_be_translated.push(remaining_text_node)
        }
        else {
            tokenized_sentence.sentence_index = sentence_index
            updated_tokenized_sentences.push(tokenized_sentence)
            sentence_index++
        }
    })
    if (sentence_to_be_translated_index != -1) {
        TranslateAnuvaad.translateFromAnuvaad(sentence_to_be_translated, pdf_parser.model ? pdf_parser.model.url_end_point : null, function (err, translation) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            else {
                let translated_sentence = translation[0]
                let sentence_before_translation = updated_tokenized_sentences[sentence_to_be_translated_index]
                sentence_before_translation.tagged_src = translated_sentence.tagged_src
                sentence_before_translation.tagged_tgt = translated_sentence.tagged_tgt
                sentence_before_translation.target = translated_sentence.tgt
                updated_tokenized_sentences[sentence_to_be_translated_index] = sentence_before_translation
                BaseModel.updateData(PdfSentence, { tokenized_sentences: updated_tokenized_sentences }, sentence._id, function (err, data) {
                    let translated_sentence = translation[1]
                    let sentence_before_translation = updated_tokenized_sentences[sentence_to_be_translated_index + 1]
                    sentence_before_translation.tagged_src = translated_sentence.tagged_src
                    sentence_before_translation.tagged_tgt = translated_sentence.tagged_tgt
                    sentence_before_translation.target = translated_sentence.tgt
                    updated_tokenized_sentences[sentence_to_be_translated_index + 1] = sentence_before_translation
                    BaseModel.updateData(PdfSentence, { tokenized_sentences: updated_tokenized_sentences }, sentence._id, function (err, data) {
                        LOG.info('Data updated', sentence)
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    })
                })

            }
        })
    } else {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
}

function handleMultiParaMergeIndReq(sentences, start_sentence, end_sentence, pdf_parser, res) {
    let sentence = sentences[0]
    let updated_tokenized_sentences = []
    let remaining_tokenized_sentence = []
    let beginning_found = false
    let end_found = false
    let sentence_to_be_translated = {}
    let sentence_to_be_translated_index = -1
    let sup_array = []
    sentences.map((sentence, sentindex) => {
        if (sentences.length > 1 && sentindex !== sentences.length - 1) {
            if (sentence.sup_array) {
                sup_array = sup_array.concat(sentence.sup_array)
            }
        }
        sentence.tokenized_sentences.map((tokenized_sentence, index) => {
            if (tokenized_sentence.s_id == start_sentence.s_id && tokenized_sentence.n_id == start_sentence.n_id) {
                beginning_found = true
                sentence_to_be_translated_index = index
                updated_tokenized_sentences.push(tokenized_sentence)
            }
            else if (sentindex == 0) {
                updated_tokenized_sentences.push(tokenized_sentence)
            }
            else if (tokenized_sentence.s_id == end_sentence.s_id && tokenized_sentence.n_id == end_sentence.n_id) {
                updated_tokenized_sentences[sentence_to_be_translated_index].text += ' ' + tokenized_sentence.text
                updated_tokenized_sentences[sentence_to_be_translated_index].src += ' ' + tokenized_sentence.src
                sentence_to_be_translated = updated_tokenized_sentences[sentence_to_be_translated_index]
            }
            else {
                remaining_tokenized_sentence.push(tokenized_sentence)
            }
        })
    })
    if (!remaining_tokenized_sentence || remaining_tokenized_sentence.length == 0) {
        if (sentences[sentences.length - 1].sup_array)
            sup_array = sup_array.concat(sentences[sentences.length - 1].sup_array)
    }
    if (sentence_to_be_translated_index != -1) {
        TranslateAnuvaad.translateFromAnuvaad([sentence_to_be_translated], pdf_parser.model ? pdf_parser.model.url_end_point : null, function (err, translation) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            else {
                let translated_sentence = translation[0]
                let sentence_before_translation = updated_tokenized_sentences[sentence_to_be_translated_index]
                sentence_before_translation.tagged_src = translated_sentence.tagged_src
                sentence_before_translation.tagged_tgt = translated_sentence.tagged_tgt
                sentence_before_translation.target = translated_sentence.tgt
                updated_tokenized_sentences[sentence_to_be_translated_index] = sentence_before_translation
                let update_query = { tokenized_sentences: updated_tokenized_sentences }
                if (sup_array.length > 0) {
                    update_query['sup_array'] = sup_array
                }
                BaseModel.updateData(PdfSentence, update_query, sentences[0]._id, function (err, data) {
                    LOG.info('Data updated', sentence)
                    BaseModel.updateData(PdfSentence, { tokenized_sentences: remaining_tokenized_sentence }, sentences[sentences.length - 1]._id, function (err, data) {
                        LOG.info('Data updated', sentence)
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    })
                })

            }
        })
    } else {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
}

function handleSameParaMergeIndReq(sentences, start_sentence, end_sentence, pdf_parser, res) {
    let sentence = sentences[0]
    let updated_tokenized_sentences = []
    let sentence_to_be_translated = {}
    let sentence_to_be_translated_index = -1
    sentence.tokenized_sentences.map((tokenized_sentence, index) => {
        if (tokenized_sentence.s_id == start_sentence.s_id) {
            sentence_to_be_translated_index = index
            updated_tokenized_sentences.push(tokenized_sentence)
        } else if (tokenized_sentence.s_id == end_sentence.s_id) {
            updated_tokenized_sentences[sentence_to_be_translated_index].text += ' ' + tokenized_sentence.text
            updated_tokenized_sentences[sentence_to_be_translated_index].src += ' ' + tokenized_sentence.src
            sentence_to_be_translated = updated_tokenized_sentences[sentence_to_be_translated_index]
        }
        else {
            updated_tokenized_sentences.push(tokenized_sentence)
        }
    })
    if (sentence_to_be_translated_index != -1) {
        TranslateAnuvaad.translateFromAnuvaad([sentence_to_be_translated], pdf_parser.model ? pdf_parser.model.url_end_point : null, function (err, translation) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            else {
                let translated_sentence = translation[0]
                let sentence_before_translation = updated_tokenized_sentences[sentence_to_be_translated_index]
                sentence_before_translation.tagged_src = translated_sentence.tagged_src
                sentence_before_translation.tagged_tgt = translated_sentence.tagged_tgt
                sentence_before_translation.target = translated_sentence.tgt
                updated_tokenized_sentences[sentence_to_be_translated_index] = sentence_before_translation
                BaseModel.updateData(PdfSentence, { tokenized_sentences: updated_tokenized_sentences }, sentence._id, function (err, data) {
                    LOG.info('Data updated', sentence)
                    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                    return res.status(response.http.status).json(response);
                })

            }
        })
    } else {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
}

function handleMultiParaMergeReq(sentences, start_sentence, end_sentence, pdf_parser, res) {
    let sentence = sentences[0]
    let updated_tokenized_sentences = []
    let remaining_tokenized_sentence = []
    let beginning_found = false
    let end_found = false
    let sentence_to_be_translated = {}
    let sentence_to_be_translated_index = -1
    let sup_array = []
    sentences.map((sentence, sentindex) => {
        if (sentences.length > 1 && sentindex !== sentences.length - 1) {
            if (sentence.sup_array) {
                sup_array = sup_array.concat(sentence.sup_array)
            }
        }
        sentence.tokenized_sentences.map((tokenized_sentence, index) => {
            if (tokenized_sentence.s_id == start_sentence.s_id && tokenized_sentence.n_id == start_sentence.n_id) {
                beginning_found = true
                sentence_to_be_translated_index = index
                updated_tokenized_sentences.push(tokenized_sentence)
            }
            else if (!beginning_found) {
                updated_tokenized_sentences.push(tokenized_sentence)
            } else if (end_found) {
                remaining_tokenized_sentence.push(tokenized_sentence)
            }
            else if (beginning_found && !end_found) {
                updated_tokenized_sentences[updated_tokenized_sentences.length - 1].text += ' ' + tokenized_sentence.text
                updated_tokenized_sentences[updated_tokenized_sentences.length - 1].src += ' ' + tokenized_sentence.src
                sentence_to_be_translated = updated_tokenized_sentences[updated_tokenized_sentences.length - 1]
            }
            if (tokenized_sentence.s_id == end_sentence.s_id && tokenized_sentence.n_id == end_sentence.n_id) {
                end_found = true
            }
        })
    })
    if (!remaining_tokenized_sentence || remaining_tokenized_sentence.length == 0) {
        if (sentences[sentences.length - 1].sup_array)
            sup_array = sup_array.concat(sentences[sentences.length - 1].sup_array)
    }
    if (sentence_to_be_translated_index != -1) {
        TranslateAnuvaad.translateFromAnuvaad([sentence_to_be_translated], pdf_parser.model ? pdf_parser.model.url_end_point : null, function (err, translation) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            else {
                let translated_sentence = translation[0]
                let sentence_before_translation = updated_tokenized_sentences[sentence_to_be_translated_index]
                sentence_before_translation.tagged_src = translated_sentence.tagged_src
                sentence_before_translation.tagged_tgt = translated_sentence.tagged_tgt
                sentence_before_translation.target = translated_sentence.tgt
                updated_tokenized_sentences[sentence_to_be_translated_index] = sentence_before_translation
                if (sentences.length > 2) {
                    let index = 0
                    async_lib.each(sentences, (sentence, cb) => {
                        if (index == 0) {
                            let update_query = { tokenized_sentences: updated_tokenized_sentences }
                            if (sup_array.length > 0) {
                                update_query['sup_array'] = sup_array
                            }
                            BaseModel.updateData(PdfSentence, update_query, sentence._id, function (err, data) {
                                if (err) {
                                    LOG.error(err)
                                } else {
                                    LOG.info('Data updated', sentence)
                                }
                                cb()
                            })
                        } else if (index == sentences.length - 1) {
                            BaseModel.updateData(PdfSentence, { tokenized_sentences: remaining_tokenized_sentence }, sentence._id, function (err, data) {
                                if (err) {
                                    LOG.error(err)
                                } else {
                                    LOG.info('Data updated', sentence)
                                }
                                cb()
                            })
                        } else {
                            BaseModel.updateData(PdfSentence, { tokenized_sentences: [] }, sentence._id, function (err, data) {
                                if (err) {
                                    LOG.error(err)
                                } else {
                                    LOG.info('Data updated', sentence)
                                }
                                cb()
                            })
                        }
                        index++
                    }, function (err) {
                        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                        return res.status(response.http.status).json(response);
                    })
                } else {
                    let update_query = { tokenized_sentences: updated_tokenized_sentences }
                    if (sup_array.length > 0) {
                        update_query['sup_array'] = sup_array
                    }
                    BaseModel.updateData(PdfSentence, update_query, sentences[0]._id, function (err, data) {
                        LOG.info('Data updated', sentence)
                        BaseModel.updateData(PdfSentence, { tokenized_sentences: remaining_tokenized_sentence }, sentences[sentences.length - 1]._id, function (err, data) {
                            LOG.info('Data updated', sentence)
                            let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                            return res.status(response.http.status).json(response);
                        })
                    })
                }

            }
        })
    } else {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
}

function handleSameParaMergeReq(sentences, start_sentence, end_sentence, pdf_parser, res) {
    let sentence = sentences[0]
    let updated_tokenized_sentences = []
    let beginning_found = false
    let end_found = false
    let sentence_to_be_translated = {}
    let sentence_to_be_translated_index = -1
    sentence.tokenized_sentences.map((tokenized_sentence, index) => {
        if (tokenized_sentence.s_id == start_sentence.s_id) {
            beginning_found = true
            sentence_to_be_translated_index = index
            updated_tokenized_sentences.push(tokenized_sentence)
        }
        else if (!beginning_found || end_found) {
            updated_tokenized_sentences.push(tokenized_sentence)
        }
        else if (beginning_found && !end_found) {
            updated_tokenized_sentences[updated_tokenized_sentences.length - 1].text += ' ' + tokenized_sentence.text
            updated_tokenized_sentences[updated_tokenized_sentences.length - 1].src += ' ' + tokenized_sentence.src
            sentence_to_be_translated = updated_tokenized_sentences[updated_tokenized_sentences.length - 1]
        }
        if (tokenized_sentence.s_id == end_sentence.s_id) {
            end_found = true
        }
    })
    if (sentence_to_be_translated_index != -1) {
        TranslateAnuvaad.translateFromAnuvaad([sentence_to_be_translated], pdf_parser.model ? pdf_parser.model.url_end_point : null, function (err, translation) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            else {
                let translated_sentence = translation[0]
                let sentence_before_translation = updated_tokenized_sentences[sentence_to_be_translated_index]
                sentence_before_translation.tagged_src = translated_sentence.tagged_src
                sentence_before_translation.tagged_tgt = translated_sentence.tagged_tgt
                sentence_before_translation.target = translated_sentence.tgt
                updated_tokenized_sentences[sentence_to_be_translated_index] = sentence_before_translation
                BaseModel.updateData(PdfSentence, { tokenized_sentences: updated_tokenized_sentences }, sentence._id, function (err, data) {
                    LOG.info('Data updated', sentence)
                    let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
                    return res.status(response.http.status).json(response);
                })

            }
        })
    } else {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
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
    pdf_parser_process.pdf_path = escape(file.name)
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
                BaseModel.saveData(PdfParser, [pdf_parser_process], function (err, doc) {
                    if (err) {
                        LOG.error(err)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    } else {
                        let index = 1
                        let output_res = {}
                        processHtml(pdf_parser_process, index, output_res, false, 1, true, false, null, res, true)
                        let response = new Response(StatusCode.SUCCESS, doc).getRsp()
                        return res.status(response.http.status).json(response);
                    }
                })
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
    let model = {}
    if (typeof req.body.model == "string") {
        model = JSON.parse(req.body.model)
    } else {
        model = req.body.model
    }
    if (!model.model_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let file = req.files.pdf_data
    let pdf_parser_process = {}
    pdf_parser_process.session_id = UUIDV4()
    pdf_parser_process.process_name = req.body.process_name
    pdf_parser_process.pdf_path = escape(file.name)
    pdf_parser_process.source_lang = req.body.source_lang
    pdf_parser_process.target_lang = req.body.target_lang
    pdf_parser_process.download_source_path = pdf_parser_process.session_id + '.pdf'
    pdf_parser_process.status = STATUS_PROCESSING
    pdf_parser_process.created_by = userId
    pdf_parser_process.model = model
    pdf_parser_process.created_on = new Date()
    fs.mkdir(BASE_PATH_UPLOAD + pdf_parser_process.session_id, function (e) {
        fs.writeFile(BASE_PATH_UPLOAD + pdf_parser_process.session_id + '/' + pdf_parser_process.pdf_path, file.data, function (err) {
            fs.writeFile(BASE_PATH_NGINX + pdf_parser_process.session_id + '.pdf', file.data, function (err) {
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
                    BaseModel.saveData(PdfParser, [pdf_parser_process], function (err, doc) {
                        if (err) {
                            LOG.error(err)
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        } else {
                            let index = 1
                            let output_res = {}
                            processHtml(pdf_parser_process, index, output_res, false, 1, true, true, model, res, true, userId)
                            let response = new Response(StatusCode.SUCCESS, doc).getRsp()
                            return res.status(response.http.status).json(response);
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
    condition = { created_by: userId }
    if (status) {
        condition['status'] = status
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
    let userId = req.headers['ad-userid']
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    let condition = {}
    if (!session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (status) {
        condition = { status: status }
    }
    condition['tokenized_sentences'] = { $elemMatch: { status: { $ne: STATUS_DELETED } } }
    condition['session_id'] = session_id
    let pdf_process_condition = { session_id: session_id, created_by: userId }
    PdfSentence.countDocuments(condition, function (err, count) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        BaseModel.findByCondition(PdfParser, pdf_process_condition, null, null, null, function (err, models) {
            if (!models || models.length == 0) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_DATA_NOTFOUND, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            let pdf_process = models[0]._doc
            BaseModel.findByEmbeddedCondition(PdfSentence, condition, pagesize, pageno, 'para_index', {}, function (err, models) {
                if (err) {
                    LOG.error(err)
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let response = new Response(StatusCode.SUCCESS, models, count, null, null, null, pdf_process.model, pdf_process).getRsp()
                return res.status(response.http.status).json(response);
            })
        })
    })
}

exports.updatePdfSentences = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.sentences) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    async_lib.each(req.body.sentences, (sentence, cb) => {
        let id = mongoose.Types.ObjectId(sentence._id)
        BaseModel.findByCondition(PdfParser, { session_id: sentence.session_id }, null, null, null, function (err, pdfparser) {
            if (pdfparser && pdfparser.length > 0) {
                let pdf_parser_process = pdfparser[0]._doc
                BaseModel.findById(PdfSentence, id, function (err, doc) {
                    if (doc) {
                        let sentencedb = doc._doc
                        if (sentencedb.is_table) {
                            for (var key in sentence.table_items) {
                                for (var col in sentence.table_items[key]) {
                                    if (sentence.table_items[key][col].target !== sentencedb.table_items[key][col].target && sentence.table_items[key][col].target && sentence.table_items[key][col].target.trim().length > 0) {
                                        const sentence_to_save = { source: sentence.table_items[key][col].text, tagged_src: sentence.table_items[key][col].tagged_src, tagged_tgt: sentence.table_items[key][col].tagged_tgt, target: sentence.table_items[key][col].target, created_on: new Date(), userId: userId }
                                        SentencesRedis.saveSentence(sentence_to_save, userId + '_' + pdf_parser_process.target_lang, function (err, doc) {
                                            LOG.info('data saved in redis')
                                        })
                                    }
                                }
                            }
                        } else {
                            sentence.tokenized_sentences.map((sentence_obj, index) => {
                                if (sentence_obj.target !== sentencedb.tokenized_sentences[index].target && sentence_obj.target && sentence_obj.target.trim().length > 0) {
                                    let sentence_to_save = { source: sentence_obj.src, tagged_src: sentence_obj.tagged_src, tagged_tgt: sentence_obj.tagged_tgt, target: sentence_obj.target, created_on: new Date(), userId: userId }
                                    SentencesRedis.saveSentence(sentence_to_save, userId + '_' + pdf_parser_process.target_lang, function (err, doc) {
                                        LOG.info('data saved in redis')
                                    })
                                }
                            })
                        }
                        let update_obj = { table_items: sentence.table_items, tokenized_sentences: sentence.tokenized_sentences }
                        BaseModel.updateData(PdfSentence, update_obj, sentence._id, function (err, doc) {
                            if (err) {
                                LOG.error(err)
                            }
                            cb()
                        })
                    }
                    else {
                        cb()
                    }
                })
            } else {
                cb()
            }
        })
    }, function (err) {
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.makeDocFromSentences = function (req, res) {
    if (!req || !req.body || !req.body.session_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let condition = { session_id: req.body.session_id }
    BaseModel.findByCondition(PdfParser, condition, null, null, null, function (err, pdf_parsers) {
        let pdf_parser_obj = pdf_parsers[0]._doc
        BaseModel.findByCondition(PdfSentence, condition, null, null, 'para_index', function (err, sentences) {
            if (err) {
                LOG.error(err)
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            DocxCreator.covertJsonToDocForSentences(sentences, 'target', BASE_PATH_NGINX, pdf_parser_obj.process_name, function (err, filepath) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let response = new Response(StatusCode.SUCCESS, filepath).getRsp()
                return res.status(response.http.status).json(response);
            })
        })
    })
}


function sentenceCase(str) {
    if ((str === null) || (str === ''))
        return false;
    else
        str = str.toString();

    return str.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}