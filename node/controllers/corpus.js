/*
 * @Author: ghost 
 * @Date: 2019-08-29 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-08-30 14:22:51
 */
var Corpus = require('../models/corpus');
var SentenceLog = require('../models/sentencelog');
var Sentence = require('../models/sentence');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var Status = require('../utils/status').Status
var LOG = require('../logger/logger').logger
var UUIDV4 = require('uuid/v4')
var async = require('async');
var fs = require("fs");
var ParallelCorpus = require('../models/parallelCorpus');
var Sentence = require('../models/sentence')
const CJSON = require('circular-json');
const { Translate } = require('@google-cloud/translate');
const projectId = "translate-1552888031121";

var COMPONENT = "corpus";
var PARALLEL_CORPUS_COMPONENT = "parallelCorpus";

const LANGUAGES = {
    'Hindi': 'hi',
    'English': 'en',
    'Bengali': 'bn',
    'Gujarati': 'gu',
    'Marathi': 'mr',
    'Kannada': 'kn',
    'Telugu': 'te',
    'Malayalam': 'ml',
    'Punjabi': 'pa',
    'Tamil': 'ta'
}


exports.fetchCorpus = function (req, res) {
    Corpus.fetchAll((err, corpus) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, corpus).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.fetchCorpusSentences = function (req, res) {
    var basename = req.query.basename
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    var status = req.query.status
    if (basename == null || basename.length == 0) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    Corpus.findOne({ basename: basename }, function (error, corpus) {
        Sentence.countDocuments({ basename: basename }, function (err, count) {
            LOG.info(count)
            Sentence.fetch(basename, pagesize, pageno, status, null, function (err, sentences) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }

                if (sentences && Array.isArray(sentences) && sentences.length > 0) {
                    let sentences_arr = []
                    let target_lang = 'en'
                    target_lang = LANGUAGES[corpus['_doc']['target_lang']] ? LANGUAGES[corpus['_doc']['target_lang']] : 'en'
                    sentences.map((sentence) => {
                        sentences_arr.push(sentence._doc.source)
                    })
                    return translateFromGoogle(target_lang, sentences_arr, sentences, res, count)
                }
                let response = new Response(StatusCode.SUCCESS, sentences).getRsp()
                return res.status(response.http.status).json(response);
            })
        })
    })
}

var translateFromGoogle = function (targetlang, text, sentences, res, count) {
    const translate = new Translate({
        projectId: projectId,
    });

    // Translates some text into English
    translate
        .translate(text, targetlang)
        .then(results => {
            let sentencearr = []
            results[0].map((r, index) => {
                var s = sentences[index]
                s['_doc']['translation'] = r
                sentencearr.push(s)
            })
            let response = new Response(StatusCode.SUCCESS, sentencearr, count).getRsp()
            return res.status(response.http.status).json(response);
        })
        .catch(err => {
            LOG.error(err)
            let response = new Response(StatusCode.SUCCESS, sentences).getRsp()
            return res.status(response.http.status).json(response);
        });
}

exports.updateSentences = function (req, res) {
    //Check required params
    if (!req.body || !req.body.sentences || !Array.isArray(req.body.sentences)) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    async.each(req.body.sentences, function (sentence, callback) {
        LOG.info("Updating sentence [%s]", JSON.stringify(sentence))
        Sentence.find({ _id: sentence._id }, {}, function (err, results) {
            if (results && Array.isArray(results) && results.length > 0) {
                var sentencedb = results[0]
                let userId = req.headers['ad-userid']
                let sentencelog = { edited_by: userId, status: sentencedb._doc.status, source_words: sentencedb._doc.source.split(' '), target_words: sentencedb._doc.target.split(' '), source_edited_words: sentence.source.split(' '), target_edited_words: sentence.target.split(' '), updated_on: new Date(), parent_id: sentencedb._doc._id, basename: sentencedb._doc.basename, source: sentencedb._doc.source, source_edited: sentence.source, target: sentencedb._doc.target, target_edited: sentence.target }
                SentenceLog.save([sentencelog], (err, results) => {
                    if (err) {
                        LOG.error(err)
                        callback()
                    }
                    Sentence.updateSentence(sentence, (error, results) => {
                        if (error) {
                            LOG.error(error)
                            callback()
                        }
                        LOG.info("Sentence updated [%s]", JSON.stringify(sentence))
                        callback()
                    })
                })

            } else {
                callback('data not found')
            }
        })
    }, function (err) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let apistatus = new APIStatus(StatusCode.SUCCESS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    });
}

exports.updateSentencesStatus = function (req, res) {
    //Check required params
    if (!req.body || !req.body.sentences || !Array.isArray(req.body.sentences)) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    async.each(req.body.sentences, function (sentence, callback) {
        LOG.info("Updating sentence status [%s]", JSON.stringify(sentence))
        Sentence.find({ _id: sentence._id }, {}, function (err, results) {
            if (results && Array.isArray(results) && results.length > 0) {
                var sentencedb = results[0]
                let userId = req.headers['ad-userid']
                let sentencelog = { edited_by: userId, source: sentencedb._doc.source, target: sentencedb._doc.target, is_status_changed: true, updated_on: new Date(), parent_id: sentencedb._doc._id, basename: sentencedb._doc.basename, status: sentencedb._doc.status, status_edited: sentence.status }
                SentenceLog.save([sentencelog], (err, results) => {
                    if (err) {
                        LOG.error(err)
                        callback()
                    }
                    Sentence.updateSentenceStatus(sentence, (error, results) => {
                        if (error) {
                            LOG.error(error)
                            callback()
                        }
                        LOG.info("Sentence updated [%s]", JSON.stringify(sentence))
                        callback()
                    })
                })

            }
            else {
                LOG.info('Data not found')
                callback('data not found')
            }
        })
    }, function (err) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let apistatus = new APIStatus(StatusCode.SUCCESS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    });
}

exports.translateSource = function (req, res) {
    var basename = req.query.basename
    var source = req.query.source
    if (basename == null || basename.length == 0 || !source || source.length == 0) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    Corpus.findOne({ basename: basename }, function (error, corpus) {
        if (corpus) {
            let target_lang = 'en'
            target_lang = corpus['_doc'] && LANGUAGES[corpus['_doc']['target_lang']] ? LANGUAGES[corpus['_doc']['target_lang']] : 'en'
            const translate = new Translate({
                projectId: projectId,
            });
            translate
                .translate(source, target_lang)
                .then(results => {
                    let response = new Response(StatusCode.SUCCESS, [results[0]]).getRsp()
                    return res.status(response.http.status).json(response);
                })
                .catch(err => {
                    LOG.error(err)
                    let response = new Response(StatusCode.SUCCESS, sentences).getRsp()
                    return res.status(response.http.status).json(response);
                });
        }
        else {
            let response = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(response.http.status).json(response);
        }
    })
}

exports.updateSentencesGrade = function (req, res) {
    //Check required params
    if (!req.body || !req.body.sentences || !Array.isArray(req.body.sentences)) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    async.each(req.body.sentences, function (sentence, callback) {
        LOG.info("Updating sentence grade [%s]", JSON.stringify(sentence))
        if (sentence.rating || sentence.spelling_rating || sentence.context_rating || sentence.name_accuracy_rating || sentence.comments) {
            Sentence.find({ _id: sentence._id }, {}, function (err, results) {
                if (results && Array.isArray(results) && results.length > 0) {
                    var sentencedb = results[0]
                    let userId = req.headers['ad-userid']
                    let sentencelog = { edited_by: userId, source: sentencedb._doc.source, target: sentencedb._doc.target, is_grade_changed: true, updated_on: new Date(), parent_id: sentencedb._doc._id, basename: sentencedb._doc.basename, status: sentencedb._doc.status, name_accuracy_rating_edited: sentence.name_accuracy_rating, name_accuracy_rating: sentencedb._doc.name_accuracy_rating, spelling_rating_edited: sentence.spelling_rating, grade_edited: sentence.rating, grade: sentencedb._doc.rating, spelling_rating: sentencedb._doc.spelling_rating, context_rating: sentencedb._doc.context_rating, context_rating_edited: sentence.context_rating, comments: sentencedb._doc.comments, comments_edited: sentence.comments }
                    if (req.body.modelid) {
                        sentencelog.modelid = req.body.modelid
                    }
                    else if (sentencedb._doc.basename && sentencedb._doc.basename.indexOf('_') > 0) {
                        sentencelog.modelid = sentencedb._doc.basename.split('_')[1]
                    }
                    SentenceLog.save([sentencelog], (err, results) => {
                        if (err) {
                            LOG.error(err)
                            callback()
                        }
                        Sentence.updateSentenceGrade(sentence, (error, results) => {
                            callback()
                        })
                    })
                } else {
                    LOG.info('Data not found')
                    callback('data not found')
                }
            })
        } else {
            LOG.info('Rating not specified')
            callback()
        }
    }, function (err) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let apistatus = new APIStatus(StatusCode.SUCCESS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    });
}

exports.uploadCorpus = function (req, res) {
    //Check required params
    if (!req.files || req.files.length == 0 || !req.body || !req.body.name || !req.body.lang) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let corpusid = UUIDV4()
    //Create corpus obj and save
    let corpus = { status: 'ACTIVE', created_on: new Date(), corpusid: corpusid, name: req.body.name, lang: req.body.lang }
    corpus.tags = ['BASE_CORPUS', req.body.lang]
    Corpus.saveCorpus(corpus, (err, doc) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        fs.readFile(req.files[0].path, 'utf8', function (err, data) {
            if (data.length > 0) {
                let sentences = data.split('\n')
                let sentencearr = []
                sentences.map((sentence, index) => {
                    let sentenceobj = { sentence: sentence, index: index }
                    sentenceobj.tags = [corpusid, req.body.lang]
                    sentenceobj.original = true
                    sentenceobj.parallelcorpusid = []
                    sentencearr.push(sentenceobj)
                })
                Sentence.saveSentences(sentencearr, (err, docs) => {
                    if (err) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    let apistatus = new APIStatus(StatusCode.SUCCESS, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                })
            }
        })
    })
}

exports.fetchParallelCorpus = function (req, res) {
    Corpus.fetchAll((err, corpus) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, corpus).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.getParallelCorpusSentence = function (req, res) {
    var basename = req.query.basename
    if (basename == null || basename.length == 0) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    ParallelCorpus.findById(basename, (err, result) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }

        sourceId = result.source_id
        targetId = result.target_id
        console.log("sourceId = " + sourceId)
        console.log("targetId = " + targetId)
        Sentence.findWithtagId(basename, sourceId, (err, source_sentences) => {
            if (err) {
                console.log("error while finding source sentence")
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            console.log("source sentences are " + CJSON.stringify(source_sentences))
            Sentence.findWithtagId(basename, targetId, (err, target_sentences) => {
                if (err) {
                    console.log("error while finding target sentence")
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                console.log("target sentences are " + target_sentences.sentence)
                let results = { 'source': source_sentences.sentence, 'target': target_sentences.sentence }
                let response = new Response(StatusCode.SUCCESS, results).getRsp()
                return res.status(response.http.status).json(response);
            })
        })
    })
}



