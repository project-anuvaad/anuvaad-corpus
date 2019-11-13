var Response = require('../models/response')
var Benchmark = require('../models/benchmark');
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var Sentence = require('../models/sentence');
var Nmtmodels = require('../models/nmt');
var LOG = require('../logger/logger').logger
var SentenceLog = require('../models/sentencelog');
var async = require('async')
var axios = require('axios');

var COMPONENT = "reports";

const STATUS_ACCEPTED = 'ACCEPTED'
const STATUS_REJECTED = 'REJECTED'
const STATUS_ACTIVE = 'ACTIVE'
const ES_SERVER_URL = process.env.GATEWAY_URL ? process.env.GATEWAY_URL : 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/admin/'
const USER_INFO_URL = ES_SERVER_URL + 'users'
const LANGUAGES = {
    'hi': 'Hindi',
    'en': 'English',
    'bn': 'Bengali',
    'gu': 'Gujarati',
    'mr': 'Marathi',
    'kn': 'Kannada',
    'te': 'Telugu',
    'ml': 'Malayalam',
    'pa': 'Punjabi',
    'ta': 'Tamil'
}

exports.fetchBenchmarkAnalyzerReports = function (req, res) {
    var from_date = req.query.from_date
    var to_date = req.query.to_date
    if (!to_date || !from_date) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    SentenceLog.aggregate([
        {
            $match: { "modelid": { $ne: null }, updated_on: { "$gte": new Date(from_date), "$lt": new Date(to_date) } }
        },
        {
            $group: {
                _id: '$modelid',
                record: {
                    $push: { parent_id: "$parent_id", source: "$source" }
                },
                parent_id: { $addToSet: "$parent_id" },
                modelid: { $addToSet: '$modelid' }
            }
        }
    ], (err, results) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let results_out = []
        if (results && Array.isArray(results)) {
            LOG.info(results)
            async.each(results, function (res, callback) {
                let word_count = 0
                let context_rating = 0
                let name_accuracy_rating = 0
                let rating = 0
                let spelling_rating = 0
                let record_unique = []
                let parent_ids = []
                if (res.record && Array.isArray(res.record)) {
                    let records_db = []
                    async.each(res.record, function (record, callback) {
                        Sentence.find({ _id: record.parent_id }, {}, function (err, results) {
                            if (results && Array.isArray(results) && results.length > 0) {
                                var sentencedb = results[0]
                                Benchmark.fetchByCondition({ basename: sentencedb._doc.basename.split('_')[0] }, (err, benchmark) => {
                                    if (benchmark && Array.isArray(benchmark) && benchmark.length > 0) {
                                        sentencedb._doc.category_name = benchmark[0]._doc.name
                                        LOG.info(sentencedb._doc)
                                    }
                                    records_db.push(sentencedb)
                                    callback()
                                })

                            }

                        })

                    }, function (err) {
                        if (err) {
                            callback('error')
                        }
                        records_db.map((record) => {
                            if (!parent_ids.includes(record._doc._id + '')) {
                                word_count += record._doc.source.split(' ').length
                                context_rating = context_rating + (record._doc.context_rating ? record._doc.context_rating : 0)
                                name_accuracy_rating = name_accuracy_rating + (record._doc.name_accuracy_rating ? record._doc.name_accuracy_rating : 0)
                                rating = rating + (record._doc.rating ? record._doc.rating : 0)
                                spelling_rating = spelling_rating + (record._doc.spelling_rating ? record._doc.spelling_rating : 0)
                                record_unique.push(record)
                                parent_ids.push(record._doc._id + '')
                            }
                        })
                        res.word_count = word_count
                        res.sentence_count = res.parent_id.length
                        res.record_unique = record_unique
                        res.context_rating = context_rating
                        res.rating = rating
                        res.spelling_rating = spelling_rating
                        res.name_accuracy_rating = name_accuracy_rating
                        results_out.push(res)
                        callback()
                    });
                }

            }, function (err) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let response = new Response(StatusCode.SUCCESS, results_out).getRsp()
                return res.status(response.http.status).json(response);
            });


        }
    })

}

exports.fetchBenchmarkReports = function (req, res) {
    var from_date = req.query.from_date
    var to_date = req.query.to_date
    if (!to_date || !from_date) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    SentenceLog.aggregate([
        {
            $match: { "modelid": { $ne: null }, updated_on: { "$gte": new Date(from_date), "$lt": new Date(to_date) } }
        },
        {
            $group: {
                _id: '$edited_by',
                record: {
                    $push: { parent_id: "$parent_id", source: "$source", model_id: "$modelid" }
                },
                parent_id: { $addToSet: "$parent_id" },
                modelid: { $addToSet: '$modelid' }
            }
        }
    ], (err, results) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let results_out = []
        if (results && Array.isArray(results)) {
            async.each(results, function (res, callback) {
                axios.get(USER_INFO_URL + '/' + res._id).then((api_res) => {
                    if (api_res.data) {
                        res.username = api_res.data.username
                        let word_count = 0
                        let record_unique = []
                        let parent_ids = []
                        if (res.record && Array.isArray(res.record)) {
                            let records_db = []
                            async.each(res.record, function (record, callback) {
                                Sentence.find({ _id: record.parent_id }, {}, function (err, results) {
                                    if (results && Array.isArray(results) && results.length > 0) {
                                        var sentencedb = results[0]
                                        Benchmark.fetchByCondition({ basename: sentencedb._doc.basename.split('_')[0] }, (err, benchmark) => {
                                            if (benchmark && Array.isArray(benchmark) && benchmark.length > 0) {
                                                sentencedb._doc.category_name = benchmark[0]._doc.name
                                                sentencedb._doc.category_id = benchmark[0]._doc._id
                                                sentencedb._doc.model_id = sentencedb._doc.basename.split('_').length > 1 ? sentencedb._doc.basename.split('_')[1] : record.model_id
                                            }
                                            records_db.push(sentencedb)
                                            callback()
                                        })

                                    }

                                })

                            }, function (err) {
                                if (err) {
                                    callback('error')
                                }
                                res.models = []
                                async.each(res.modelid, function (model, callback) {
                                    Nmtmodels.findByCondition({ $or: [{ model_id: model }, { model_id: parseInt(model) }] }, function (err, models) {
                                        if (!err && models && models.length > 0) {
                                            models[0]._doc.source_lang = LANGUAGES[models[0]._doc.source_language_code]
                                            models[0]._doc.target_lang = LANGUAGES[models[0]._doc.target_language_code]
                                            res.models.push(models[0])
                                        }
                                        callback()
                                    })
                                }, function (err) {
                                    records_db.map((record) => {
                                        if (!parent_ids.includes(record._doc._id + '' + record._doc.model_id + '')) {
                                            LOG.info(record._doc.model_id + '')
                                            res.models.map((model) => {
                                                if (record._doc.model_id == model._doc.model_id) {
                                                    if (model._doc.categories && Array.isArray(model._doc.categories)) {
                                                        let found = false
                                                        model._doc.categories.map((category) => {
                                                            if (category.category_id == record._doc.category_id) {
                                                                found = true
                                                                category.context_rating = category.context_rating + (record._doc.context_rating ? record._doc.context_rating : 0)
                                                                category.name_accuracy_rating = category.name_accuracy_rating + (record._doc.name_accuracy_rating ? record._doc.name_accuracy_rating : 0)
                                                                category.rating = category.rating + (record._doc.rating ? record._doc.rating : 0)
                                                                category.spelling_rating = category.spelling_rating + (record._doc.spelling_rating ? record._doc.spelling_rating : 0)
                                                                category.records.push(record)
                                                            }
                                                        })
                                                        if (!found) {
                                                            let category = { category_name: record._doc.category_name, category_id: record._doc.category_id, records: [record] }
                                                            category.context_rating = (record._doc.context_rating ? record._doc.context_rating : 0)
                                                            category.name_accuracy_rating = (record._doc.name_accuracy_rating ? record._doc.name_accuracy_rating : 0)
                                                            category.rating = (record._doc.rating ? record._doc.rating : 0)
                                                            category.spelling_rating = (record._doc.spelling_rating ? record._doc.spelling_rating : 0)
                                                            model._doc.categories.push(category)
                                                        }
                                                    }
                                                    else {
                                                        model._doc.categories = []
                                                        let category = { category_name: record._doc.category_name, category_id: record._doc.category_id, records: [record] }
                                                        category.context_rating = (record._doc.context_rating ? record._doc.context_rating : 0)
                                                        category.name_accuracy_rating = (record._doc.name_accuracy_rating ? record._doc.name_accuracy_rating : 0)
                                                        category.rating = (record._doc.rating ? record._doc.rating : 0)
                                                        category.spelling_rating = (record._doc.spelling_rating ? record._doc.spelling_rating : 0)
                                                        model._doc.categories.push(category)
                                                    }
                                                    if (model._doc.records_count) {
                                                        model._doc.records_count = model._doc.records_count + 1
                                                    }
                                                    else {
                                                        model._doc.records_count = 1
                                                    }
                                                }
                                            })
                                            word_count += record._doc.source.split(' ').length
                                            record_unique.push(record)
                                            parent_ids.push(record._doc._id + '' + record._doc.model_id + '')
                                        }
                                    })
                                    res.word_count = word_count
                                    res.sentence_count = res.parent_id.length
                                    res.record_unique = record_unique
                                    results_out.push(res)
                                    callback()
                                })
                            });
                        }
                    }
                    else {
                        callback('error')
                    }
                })
            }, function (err) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let response = new Response(StatusCode.SUCCESS, results_out).getRsp()
                return res.status(response.http.status).json(response);
            });


        }
    })

}

exports.fetchReports = function (req, res) {
    var from_date = req.query.from_date
    var user_id = req.query.user_id
    var to_date = req.query.to_date
    if (!user_id || !to_date || !from_date) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (!isValidDate(new Date(from_date)) || !isValidDate(new Date(to_date))) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_INVALID_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    SentenceLog.find({ edited_by: user_id, updated_on: { "$gte": new Date(from_date), "$lt": new Date(to_date) } }, (err, results) => {
        let accepted_short_sentences_count = 0
        let accepted_medium_sentences_count = 0
        let accepted_long_sentences_count = 0
        let rejected_sentences_count = 0
        let short_edited = 0
        let short_modified_words = 0
        let medium_edited = 0
        let medium_modified_words = 0
        let long_edited = 0
        let long_modified_words = 0
        if (results && results.length > 0) {
            results.map((res) => {
                if (res._doc.is_status_changed && res._doc.status_edited == STATUS_ACCEPTED) {
                    let target = res._doc.target
                    if (target && target.split(' ').length <= 10) {
                        accepted_short_sentences_count++
                    }
                    else if (target && target.split(' ').length > 10 && target.split(' ').length < 25) {
                        accepted_medium_sentences_count++
                    }
                    else {
                        accepted_long_sentences_count++
                    }
                }
                else if (res._doc.is_status_changed && res._doc.status_edited == STATUS_REJECTED) {
                    rejected_sentences_count++
                }
                else if (!res._doc.is_status_changed && !res._doc.is_grade_changed) {
                    let target_edited_words = res._doc.target_edited_words
                    let target_words = res._doc.target_words
                    let target = res._doc.target
                    if (target_words && target_edited_words) {
                        if (target_words.length <= 10) {
                            short_edited++
                            target_edited_words.map((t) => {
                                if (target.indexOf(t) < 0) {
                                    short_modified_words++
                                }
                            })
                        }
                        else if (target_words.length > 10 && target_words.length < 25) {
                            medium_edited++
                            target_edited_words.map((t) => {
                                if (target.indexOf(t) < 0) {
                                    medium_modified_words++
                                }
                            })
                        }
                        else {
                            long_edited++
                            target_edited_words.map((t) => {
                                if (target.indexOf(t) < 0) {
                                    long_modified_words++
                                }
                            })
                        }
                    }
                }
            })
        }
        let res_data = {
            accepted_short_sentences: accepted_short_sentences_count,
            accepted_medium_sentences: accepted_medium_sentences_count,
            accepted_long_sentences: accepted_long_sentences_count,
            rejected_sentences: rejected_sentences_count,
            short_edited: short_edited,
            medium_edited: medium_edited,
            long_edited: long_edited,
            short_modified_words: short_edited > 0 ? short_modified_words / short_edited : 0,
            medium_modified_words: medium_edited > 0 ? medium_modified_words / medium_edited : 0,
            long_modified_words: long_edited > 0 ? long_modified_words / long_edited : 0
        }
        let response = new Response(StatusCode.SUCCESS, res_data).getRsp()
        return res.status(response.http.status).json(response);
    })
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}