/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-01-21 16:43:41
 * @modify date 2019-01-21 16:43:41
 * @desc [description]
 */
var mongoose = require("../db/mongoose");
var Schema = mongoose.Schema;
var LOG = require('../logger/logger').logger

var SentencePairSchema = new Schema({
    processId: { type: String },
}, { strict: false });

var SentencePair = mongoose.model('sentence_pair', SentencePairSchema, 'sentence_pair');

SentencePair.findByCondition = function (condition, cb) {
    SentencePair.find(condition, {}, { sort: { 'serial_no': -1 } }, function (err, data) {
        if (err) {
            LOG.error("Unable to find SentencePair due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, data);
    })
}

SentencePair.updateSentencePair = function (sentencePair, cb) {
    SentencePair.collection.updateOne({ _id: mongoose.Types.ObjectId(sentencePair._id) }, { $set: { updated: sentencePair.updated, target: sentencePair.target, accepted: sentencePair.accepted, viewed: sentencePair.viewed } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}

module.exports = SentencePair;