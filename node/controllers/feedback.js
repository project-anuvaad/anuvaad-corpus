var FeedbackQuestion = require('../models/feedback_questions');
var TranslationProcess = require('../models/translation_process');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger
var async = require('async')

var COMPONENT = "feedback";
const SATUS_DELETED = 'DELETED'

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
                obj.title = translation_process_obj.title
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