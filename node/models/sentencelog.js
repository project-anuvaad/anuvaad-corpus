var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var SentenceLogSchema = new Schema({
    _id: {
        type: String
    },
}, {
    strict: true
});
var SentenceLog = mongoose.model('SentenceLog', SentenceLogSchema, 'sentencelog');

SentenceLog.save = function(sentencelogs, cb){
    SentenceLog.collection.insertMany(sentencelogs, function (err, docs) {
        if (err) {
            return cb(err, null)
        } else {
            LOG.debug('%s sentencelogs was successfully stored.', JSON.stringify(docs));
            return cb(null, docs)
        }
    })
}

module.exports = SentenceLog;