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
            LOG.debug('%s user_high_court was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}


UserHighCourt.findByCondition = function(condition, cb){
    UserHighCourt.find(condition, function (err, user_high_courts) {
        if (err) {
            LOG.error("Unable to find user_high_courts due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.debug("[%s] user_high_courts found",user_high_courts);
        return cb(null, user_high_courts);
    })
}

module.exports = UserHighCourt;