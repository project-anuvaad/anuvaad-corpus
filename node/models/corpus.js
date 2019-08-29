var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var CorpusSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var Corpus = mongoose.model('Corpus', CorpusSchema);

Corpus.fetchAll = function(cb){
    Corpus.find({
    }, function (err, corpus) {
        if (err) {
            LOG.error("Unable to find corpus due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.info("[%s] Products found for this [%s] search string");
        return cb(null, corpus);
    })
}

module.exports = Corpus;