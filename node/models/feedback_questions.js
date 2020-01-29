var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var FeedbackQuestionsSchema = new Schema({
    _id: { type: String },
}, { strict: false });
var FeedbackQuestions = mongoose.model('FeedbackQuestions', FeedbackQuestionsSchema, 'feedback_questions');


FeedbackQuestions.saveFeedbackQuestions = function (feedback_question, cb) {
    FeedbackQuestions.collection.insert(feedback_question, function (err, docs) {
        if (err) {
            return cb(err, null);
        } else {
            LOG.debug('%s feedback_question was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}

FeedbackQuestions.updateFeedbackQuestions = function (feedback_question, cb) {
    FeedbackQuestions.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(feedback_question._id) }, { $set: { question: feedback_question.question, type: feedback_question.type, status: feedback_question.status } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}

FeedbackQuestions.findByCondition = function (condition, cb) {
    FeedbackQuestions.find(condition, function (err, feedback_questions) {
        if (err) {
            LOG.error("Unable to find feedback_questions due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.debug("[%s] feedback_questions found", feedback_questions);
        return cb(null, feedback_questions);
    })
}

module.exports = FeedbackQuestions;