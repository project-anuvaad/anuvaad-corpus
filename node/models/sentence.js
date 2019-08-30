var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var SentenceSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var Sentence = mongoose.model('Corpussentence', SentenceSchema);


Sentence.saveSentences = function(sentences, cb){
    Sentence.collection.insertMany(sentences,function(err,docs){
        if (err) {
            return cb(err, null)
        } else {
            LOG.info('%s sentences was successfully stored.', JSON.stringify(docs));
            return cb(null, docs)
        }
    })
}

module.exports = Sentence;