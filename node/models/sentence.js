var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var SentenceSchema = new Schema({
}, {
    strict: true
});
var Sentence = mongoose.model('Corpussentence', SentenceSchema, 'sentence');

const STATUS_EDITED = 'EDITED'

Sentence.saveSentences = function (sentences, cb) {
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
    Sentence.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(sentence._id)}, { $set: { status: STATUS_EDITED,source: sentence.source, target: sentence.target } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        LOG.info(doc)
        cb(null, doc)
    });
}

Sentence.updateSentenceStatus = function (sentence, cb) {
    Sentence.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(sentence._id) }, { $set: { status: sentence.status } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}

Sentence.updateSentenceGrade = function (sentence, cb) {
    Sentence.collection.updateOne({ _id: mongoose.Types.ObjectId(sentence._id) }, { $set: { rating: sentence.rating, spelling_rating:  sentence.spelling_rating} }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
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

Sentence.fetchByAssignedTo = function (status, assigned_to, cb) {
    Sentence.find({ status: status, assigned_to: assigned_to }, function (err, sentences) {
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