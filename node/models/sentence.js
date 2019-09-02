var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var SentenceSchema = new Schema({
    _id: {
        type: String
    },
}, {
    strict: false
});
var Sentence = mongoose.model('Corpussentence', SentenceSchema);


Sentence.saveSentences = function (sentences, cb) {
    LOG.info(sentences.length)
    Sentence.collection.insertMany(sentences, function (err, docs) {
        if (err) {
            // TODO: handle error
            return cb(err, null)
        } else {
            LOG.info('%s sentences was successfully stored.', JSON.stringify(docs));
            return cb(null, docs)
        }
    })
}

Sentence.findWithtagId = function (parallelCorpusId, tagId, cb) {
    var corpusIds = []
    if (parallelCorpusId != null) {
        corpusIds = [parallelCorpusId]
        Sentence.collection.findOne({
            "tags": tagId,
            "parallelcorpusid": parallelCorpusId}, function (err, sentences) {
            if (err) {
                LOG.error("Unable to find sentences id  due to [%s]", tagId, JSON.stringify(err));
                return cb(err, null);
            }
            console.log("sentences are  "+sentences.sentence)
            return cb(null, sentences)
        })
    } else {
        
        Sentence.collection.find({"tags": tagId,"parallelcorpusid": corpusIds}).sort({"index": 1}, function (err, sentences) {
            if (err) {
                LOG.error("Unable to find sentences id  due to [%s]", tagId, JSON.stringify(err));
                return cb(err, null);
            }
            console.log("sentences are "+sentences.sentence)
            return cb(null, sentences)
        })

    }
}

module.exports = Sentence;