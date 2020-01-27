var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var LanguageSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var Language = mongoose.model('Language', LanguageSchema);


Language.saveLanguage = function(language, cb){
    Language.collection.insert(language,function(err,docs){
        if (err) {
            // TODO: handle error
            return cb(err, null);
        } else {
            LOG.debug('%s language was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}

Language.updateLanguage = function (language, cb) {
    Language.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(language._id)}, { $set: { language_code: language.language_code, language_name: language.language_name,status: language.status} }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        LOG.debug(doc)
        cb(null, doc)
    });
}

Language.findByCondition = function(condition, cb){
    Language.find(condition, function (err, languages) {
        if (err) {
            LOG.error("Unable to find languages due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.debug("[%s] languages found",languages);
        return cb(null, languages);
    })
}


module.exports = Language;