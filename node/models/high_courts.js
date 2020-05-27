var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var HighCourtSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var HighCourt = mongoose.model('HighCourt', HighCourtSchema, 'highcourt');


HighCourt.saveHighCourt = function(high_court, cb){
    HighCourt.collection.insert(high_court,function(err,docs){
        if (err) {
            return cb(err, null);
        } else {
            LOG.debug('%s high_court was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}

HighCourt.updateHighCourt = function (high_court, cb) {
    HighCourt.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(high_court._id)}, { $set: { high_court_code: high_court.high_court_code, high_court_name: high_court.high_court_name,status: high_court.status} }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        LOG.debug(doc)
        cb(null, doc)
    });
}

HighCourt.findByCondition = function(condition, cb){
    HighCourt.find(condition, function (err, high_courts) {
        if (err) {
            LOG.error("Unable to find high_courts due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.debug("[%s] high_courts found",high_courts);
        return cb(null, high_courts);
    })
}

module.exports = HighCourt;