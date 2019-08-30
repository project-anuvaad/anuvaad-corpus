var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var CorpusSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var Corpus = mongoose.model('Singlecorpus', CorpusSchema);

Corpus.fetchAll = function(cb){
    Corpus.find({
    }, function (err, corpus) {
        if (err) {
            LOG.error("Unable to find corpus due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.info("[%s] Corpus found",corpus);
        return cb(null, corpus);
    })
}

Corpus.saveCorpus = function(corpus, cb){
    Corpus.collection.insert(corpus,function(err,docs){
        if (err) {
            // TODO: handle error
            return cb(err, null);
        } else {
            console.info('%s corpus was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}

module.exports = Corpus;