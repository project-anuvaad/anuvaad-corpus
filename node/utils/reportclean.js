var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var ObjectID = require('mongodb').ObjectID;
var Schema = mongoose.Schema;
var async = require('async');

var CorpusSchema = new Schema({
    _id: { type: String },
}, { strict: false });
var Corpus = mongoose.model('Singlecorpus', CorpusSchema, 'sentencelog');

Corpus.fetchAll = function (id, cb) {
    Corpus.find({ edited_by: id }, function (err, corpus) {
        if (err) {
            LOG.error("Unable to find corpus due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        // LOG.info("[%s] Corpus found",corpus);
        async.each(corpus, function (c, callback) {
            let source = c._doc.source_edited.split('\n').join('')
            let target = c._doc.target_edited.split('\n').join('')
            if (target.includes(source)) {
                target = target.replace(source, '')
                Corpus.collection.updateOne({ _id: new ObjectID(c._doc._id) }, { $set: { target_edited: target, target_edited_words: target.split(' ') } }, { upsert: false }, function (err, doc) {
                    if (err) {
                        console.error(err)
                    }
                    callback()
                });
            }
            else {
                callback()
            }
        }, function (err) {
            console.log('completed')
        })
    })

}

if (process.argv.length > 2) {
    // console.log(process.argv[2]);
    Corpus.fetchAll(process.argv[2], function (err, corpus) {
        // console.log(corpus.length)
    })
}


module.exports = Corpus;
