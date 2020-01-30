var FeedbackQuestion = require('../models/feedback_questions');
var TranslationProcess = require('../models/translation_process');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger
var async = require('async')
var axios = require('axios');

var COMPONENT = "feedback";
const SATUS_DELETED = 'DELETED'
const FEEDBACK_INDEX = 'feedback_report'

exports.fetchFeedbackQuestions = function (req, res) {
    FeedbackQuestion.findByCondition({ $or: [{ status: { $exists: false } }, { status: { $ne: SATUS_DELETED } }] }, function (err, feedback_questions) {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, feedback_questions).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.saveFeedbackQuestions = function (req, res) {
    if (!req || !req.body || !req.body.feedback_questions) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    async.each(req.body.feedback_questions, function (d, callback) {
        if (d._id) {
            FeedbackQuestion.updateFeedbackQuestions(d, function (err, doc) {
                if (err)
                    LOG.error(err)
                callback()
            })
        } else {
            FeedbackQuestion.saveFeedbackQuestions(d, function (err, doc) {
                if (err)
                    LOG.error(err)
                callback()
            })
        }

    }, function (err) {
        let response = new Response(StatusCode.SUCCESS, COMPONENT).getRsp()
        return res.status(response.http.status).json(response);
    });
}


exports.checkFeedbackPending = function (req, res) {
    let userId = req.headers['ad-userid']
    TranslationProcess.findByCondition({ created_by: userId, feedback_pending: true }, function (err, translation_process) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        } else if (translation_process && translation_process.length > 0) {
            let translation_process_obj = translation_process[0]._doc
            FeedbackQuestion.findByCondition({ $or: [{ status: { $exists: false } }, { status: { $ne: SATUS_DELETED } }] }, function (err, feedback_questions) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let obj = {}
                obj.title = translation_process_obj.name
                obj.basename = translation_process_obj.basename
                obj.feedback_questions = feedback_questions
                let response = new Response(StatusCode.SUCCESS, obj).getRsp()
                return res.status(response.http.status).json(response);
            })
        } else {
            let response = new Response(StatusCode.SUCCESS, {}).getRsp()
            return res.status(response.http.status).json(response);
        }
    })
}


exports.saveCapturedFeedback = async function (req, res) {
    LOG.debug('1')
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.captured_feedback || !req.body.captured_feedback.basename || !req.body.captured_feedback.questions) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let captured_feedback = req.body.captured_feedback
    TranslationProcess.findByCondition({ created_by: userId, basename: captured_feedback.basename }, function (err, translation_process) {
        if (err) {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        else if (!translation_process || translation_process.length == 0) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_INVALID_PARAMETERS, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let translation_process_obj = translation_process[0]._doc
        const questions = captured_feedback.questions
        async.each(questions, function (doc, callback) {
            axios.post('http://' + (process.env.ES_HOSTS ? process.env.ES_HOSTS : 'localhost') + ':9200/' + FEEDBACK_INDEX + '/_doc/', { question: doc.question, answer: doc.answer, source_lang: translation_process_obj.sourceLang, target_lang: translation_process_obj.targetLang, given_by: userId, created_on: new Date().toISOString() }).then(function (response) {
                callback()
            })
        }, function (err) {
            translation_process_obj.feedback_pending = false
            TranslationProcess.updateTranslationProcess(translation_process_obj, function (err, doc) {
                let response = new Response(StatusCode.SUCCESS, {}).getRsp()
                return res.status(response.http.status).json(response);
            })
        })
    })
}