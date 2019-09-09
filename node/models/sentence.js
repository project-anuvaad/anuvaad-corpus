var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var ObjectID = require('mongodb').ObjectID;
var Schema = mongoose.Schema;

var SentenceSchema = new Schema({
    _id: {
        type: String
    },
}, {
        strict: true
    });
var Sentence = mongoose.model('Corpussentence', SentenceSchema, 'sentence');



Sentence.saveSentences = function (sentences, cb) {
    LOG.info(sentences.length)
    Sentence.collection.insertMany(sentences, function (err, docs) {
        if (err) {
            return cb(err, null)
        } else {
            LOG.info('%s sentences was successfully stored.', JSON.stringify(docs));
            return cb(null, docs)
        }
    })
}

Sentence.updateSentence = function (sentence, cb) {
    Sentence.collection.updateOne({ _id: new ObjectID(sentence._id) }, { $set: { source: sentence.source, target: sentence.target } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        else {
            LOG.info(doc)
            cb(null, doc)
        }
    });
}

Sentence.updateSentenceStatus = function (sentence, cb) {
    Sentence.collection.updateOne({ _id: new ObjectID(sentence._id) }, { $set: { status: sentence.status } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        else {
            LOG.info(doc)
            cb(null, doc)
        }
    });
}

Sentence.updateSentenceGrade = function (sentence, cb) {
    Sentence.collection.updateOne({ _id: new ObjectID(sentence._id) }, { $set: { rating: sentence.rating } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        else {
            LOG.info(doc)
            cb(null, doc)
        }
    });
}

Sentence.fetch = function (basename, pagesize, pageno, status, cb) {
    Sentence.find((status ? { status: status, basename: basename } : { basename: basename }), {}, (pagesize && pageno ? { skip: (pageno - 1) * pagesize, limit: parseInt(pagesize) } : {}), function (err, sentences) {
        if (err) {
            LOG.error("Unable to find sentences  due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, sentences)
    })
}

Sentence.findWithtagId = function (parallelCorpusId, tagId, cb) {
    if (parallelCorpusId != null) {
        Sentence.collection.findOne({
            "tags": tagId,
            "parallelcorpusid": parallelCorpusId
        }, function (err, sentences) {
            if (err) {
                LOG.error("Unable to find sentences id  due to [%s]", tagId, JSON.stringify(err));
                return cb(err, null);
            }
            console.log("sentences are  " + sentences.sentence)
            return cb(null, sentences)
        })
    } else {

        Sentence.collection.find({ "tags": tagId }).sort({ "index": 1 }, function (err, sentences) {
            if (err) {
                LOG.error("Unable to find sentences id  due to [%s]", tagId, JSON.stringify(err));
                return cb(err, null);
            }
            console.log("sentences are " + sentences.sentence)
            return cb(null, sentences)
        })

    }
}

module.exports = Sentence;