var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var UserHighCourtSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var UserHighCourt = mongoose.model('UserHighCourt', UserHighCourtSchema, 'userhighcourt');


UserHighCourt.saveUserHighCourt = function(user_high_court, cb){
    UserHighCourt.collection.insert(user_high_court,function(err,docs){
        if (err) {
            return cb(err, null);
        } else {
            LOG.info('%s user_high_court was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}


HighCourt.findByCondition = function(condition, cb){
    HighCourt.find(condition, function (err, high_courts) {
        if (err) {
            LOG.error("Unable to find high_courts due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.info("[%s] high_courts found",high_courts);
        return cb(null, high_courts);
    })
}

module.exports = HighCourt;