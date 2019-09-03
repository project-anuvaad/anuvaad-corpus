var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;


var ParallelCorpusSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var ParallelCorpus = mongoose.model('Parallelcorpus', ParallelCorpusSchema);


ParallelCorpus.fetchAll = function(cb){
    ParallelCorpus.find({
    }, function (err, corpus) {
        if (err) {
            LOG.error("Unable to find ParallelCorpus due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.info("[%s] ParallelCorpus found",corpus);
        return cb(null, corpus);
    })
}
ParallelCorpus.findById = function(id,cb){
    ParallelCorpus.collection.findOne({'basename':id
    }, function (err, corpus) {
        if (err) {
            LOG.error("Unable to find ParallelCorpus by id = [%s] due to [%s]", id, JSON.stringify(err));
            return cb(err, null);
        }
        LOG.info("[%s] ParallelCorpus found with id ", corpus, id);
        return cb(null, corpus);
    })
}

module.exports = ParallelCorpus;