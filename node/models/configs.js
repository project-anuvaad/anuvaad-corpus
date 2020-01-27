var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var ConfigsSchema = new Schema({
    _id: { type: String },
}, { strict: false });
var Config = mongoose.model('Configs', ConfigsSchema, 'configs');

Config.findByCondition = function (condition, cb) {
    Config.find(condition, function (err, configs) {
        if (err) {
            LOG.error("Unable to find configs due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.debug("[%s] configs found", configs);
        return cb(null, configs);
    })
}


module.exports = Config;