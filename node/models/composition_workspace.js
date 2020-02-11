/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2020-02-11 16:43:41
 * @modify date 2020-02-11 16:43:41
 * @desc [description]
 */
var mongoose = require("../db/mongoose");
var Schema = mongoose.Schema;
var LOG = require('../logger/logger').logger

var CompositionSchema = new Schema({
    title: { type: String },

}, { strict: false });
var CompositionWorkspace = mongoose.model('composition_workspace', CompositionSchema);

CompositionWorkspace.save = function (compositionWorkspaces, cb) {
    CompositionWorkspace.collection.insertMany(compositionWorkspaces, function (err, docs) {
        if (err) {
            LOG.error('%s error occured while saving CompositionWorkspace', JSON.stringify(err));
            return cb(err, null)
        } else {
            return cb(null, docs)
        }
    })
}

CompositionWorkspace.findByCondition = function (condition, pagesize, pageno, cb) {
    CompositionWorkspace.find(condition, {}, (pagesize && pageno ? { skip: (pageno - 1) * pagesize, limit: parseInt(pagesize), sort: { '_id': -1 } } : { sort: { '_id': -1 } }), function (err, data) {
        if (err) {
            LOG.error("Unable to find CompositionWorkspace due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, data);
    })
}

CompositionWorkspace.updateCompositionWorkspace = function (compositionWorkspace, cb) {
    CompositionWorkspace.collection.updateOne({ _id: mongoose.Types.ObjectId(compositionWorkspace._id) }, { $set: { sentence_count_rejected: compositionWorkspace.sentence_count_rejected, source_file_full_path: compositionWorkspace.source_file_full_path, target_file_full_path: compositionWorkspace.target_file_full_path, status: compositionWorkspace.status, sentence_count: compositionWorkspace.sentence_count, sentence_file: compositionWorkspace.sentence_file, step: compositionWorkspace.step, sentence_file_full_path: compositionWorkspace.sentence_file_full_path } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}

module.exports = CompositionWorkspace;