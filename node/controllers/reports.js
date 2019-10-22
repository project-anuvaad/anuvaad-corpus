var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger
var SentenceLog = require('../models/sentencelog');

var COMPONENT = "reports";

const STATUS_ACCEPTED = 'ACCEPTED'
const STATUS_REJECTED = 'REJECTED'



exports.fetchBenchmarkReports = function (req, res) {
    SentenceLog.aggregate([
        {
            $match: { "modelid": { $ne: null } }
        },
        {
            $group: {
                _id: '$edited_by',
                record: {
                    $push: { parent_id: "$parent_id", source: "$source", grade_edited: "$grade_edited", context_rating_edited: "$context_rating_edited", spelling_rating_edited: "$spelling_rating_edited" }
                },
                parent_id: { $addToSet: "$parent_id" },
                modelid: { $addToSet: '$modelid' }
            }
        }
    ], (err, results) => {
        if (results && Array.isArray(results)) {
            results.map((res) => {
                let word_count = 0
                let record_unique = []
                let parent_ids = []
                if (res.record && Array.isArray(res.record)) {
                    res.record.map((record) => {
                        if (!parent_ids.includes(record.parent_id + '')) {
                            word_count += record.source.split(' ').length
                            record_unique.push(record)
                            parent_ids.push(record.parent_id + '')
                            LOG.info(parent_ids)
                        }
                    })
                }
                res.word_count = word_count
                res.sentence_count = res.parent_id.length
                res.record_unique = record_unique
            })
        }
        let response = new Response(StatusCode.SUCCESS, results).getRsp()
        return res.status(response.http.status).json(response);
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