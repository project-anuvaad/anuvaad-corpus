var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var BenchmarkSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var Benchmark = mongoose.model('Benchmark', BenchmarkSchema, 'benchmark');

Benchmark.fetchAll = function(cb){
    Benchmark.find({
    }, function (err, benchmarks) {
        if (err) {
            LOG.error("Unable to find benchmark due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.info("[%s] Benchmark found",benchmarks);
        return cb(null, benchmarks);
    })
}

Benchmark.saveCorpus = function(benchmark, cb){
    Benchmark.collection.insert(benchmark,function(err,docs){
        if (err) {
            // TODO: handle error
            return cb(err, null);
        } else {
            LOG.info('%s benchmark was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}


module.exports = Benchmark;
