var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var BenchmarkSchema = new Schema({
    _id: { type: String },
}, { strict: false });
var Benchmark = mongoose.model('Benchmark', BenchmarkSchema, 'benchmark');

Benchmark.fetchAll = function (condition, cb) {
    Benchmark.find(condition, function (err, benchmarks) {
        if (err) {
            LOG.error("Unable to find benchmark due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, benchmarks);
    })
}

Benchmark.fetchByCondition = function (condition, cb) {
    Benchmark.find(
        condition
        , function (err, benchmarks) {
            if (err) {
                LOG.error("Unable to find benchmark due to [%s]", JSON.stringify(err));
                return cb(err, null);
            }
            return cb(null, benchmarks);
        })
}

Benchmark.saveBenchmarks = function (benchmarks, cb) {
    Benchmark.collection.insertMany(benchmarks, function (err, docs) {
        if (err) {
            // TODO: handle error
            return cb(err, null);
        } else {
            return cb(null, docs);
        }
    })
}

Benchmark.updateBenchmarkData = function (benchmark,useid, cb) {
    Benchmark.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(benchmark._id)}, { $set: { assigned_to: useid } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}


module.exports = Benchmark;
