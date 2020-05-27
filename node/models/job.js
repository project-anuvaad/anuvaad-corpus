var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var JobsSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var Jobs = mongoose.model('Job', JobsSchema);

Jobs.fetchAll = function(cb){
    Jobs.find({
    }, function (err, corpus) {
        if (err) {
            LOG.error("Unable to find corpus due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.debug("[%s] Corpus found",corpus);
        return cb(null, corpus);
    })
}

Jobs.saveJob = async function(job, cb){
    Jobs.collection.insert(job,function(err,docs){
        LOG.debug('Saving job [%s]', JSON.stringify(job))
        if (err) {
            // TODO: handle error
            return cb(err, null);
        } else {
            LOG.debug('%s job was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}


module.exports = Jobs;
