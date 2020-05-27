var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var NmtmodelsSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var Nmtmodels = mongoose.model('Nmtmodels', NmtmodelsSchema);


Nmtmodels.saveModel = function(model, cb){
    Nmtmodels.collection.insert(model,function(err,docs){
        if (err) {
            // TODO: handle error
            return cb(err, null);
        } else {
            LOG.debug('%s model was successfully stored.', JSON.stringify(docs));
            return cb(null, docs);
        }
    })
}

Nmtmodels.updateModel = function (model, cb) {
    var model_to_be_saved = {}
    Object.keys(model).forEach(function(key) {
        if(key != '_id')
            model_to_be_saved[key] = model[key]
    });
    // Nmtmodels.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(model._id)}, { $set: { is_primary: model.is_primary,status: model.status, model_id: model.model_id , model_name: model.model_name} }, { upsert: false }, function (err, doc) {
    Nmtmodels.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(model._id)}, {$set: model_to_be_saved}, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        LOG.debug(doc)
        cb(null, doc)
    });
}

Nmtmodels.findByCondition = function(condition, cb){
    Nmtmodels.find(condition, function (err, models) {
        if (err) {
            LOG.error("Unable to find models due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.debug("[%s] models found",models);
        return cb(null, models);
    })
}


module.exports = Nmtmodels;