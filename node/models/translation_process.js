var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var TranslationProcessSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var TranslationProcess = mongoose.model('TranslationProcess', TranslationProcessSchema, 'translation_process');


TranslationProcess.findByCondition = function(condition, cb){
    TranslationProcess.find(condition, function (err, translation_process) {
        if (err) {
            LOG.error("Unable to find translation_process due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.debug("[%s] translation_process found",translation_process);
        return cb(null, translation_process);
    })
}

module.exports = TranslationProcess;