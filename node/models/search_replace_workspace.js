/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-01-13 16:43:41
 * @modify date 2019-01-13 16:43:41
 * @desc [description]
 */
var mongoose = require("../db/mongoose");
var Schema = mongoose.Schema;
var LOG = require('../logger/logger').logger

var SerachReplaceWorkspaceSchema = new Schema({
    title: { type: String },

}, { strict: false });
var SearchReplaceWorkspace = mongoose.model('search_replace_workspace', SerachReplaceWorkspaceSchema);

SearchReplaceWorkspace.save = function (searchReplaceWorkspaces, cb) {
    SearchReplaceWorkspace.collection.insertMany(searchReplaceWorkspaces, function (err, docs) {
        if (err) {
            LOG.error('%s error occured while saving SearchReplaceWorkspace', JSON.stringify(err));
            return cb(err, null)
        } else {
            return cb(null, docs)
        }
    })
}

SearchReplaceWorkspace.findByCondition = function (condition, pagesize, pageno, cb) {
    SearchReplaceWorkspace.find(condition, {}, (pagesize && pageno ? { skip: (pageno - 1) * pagesize, limit: parseInt(pagesize), sort: { '_id': -1 } } : { sort: { '_id': -1 } }), function (err, data) {
        if (err) {
            LOG.error("Unable to find MTWorkspace due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, data);
    })
}

SearchReplaceWorkspace.updateSearchReplaceWorkspace = function (searchReplaceWorkspace, cb) {
    SearchReplaceWorkspace.collection.updateOne({ _id: mongoose.Types.ObjectId(searchReplaceWorkspace._id) }, { $set: { sentence_count_rejected: searchReplaceWorkspace.sentence_count_rejected, source_file_full_path: searchReplaceWorkspace.source_file_full_path, target_file_full_path: searchReplaceWorkspace.target_file_full_path, status: searchReplaceWorkspace.status, sentence_count: searchReplaceWorkspace.sentence_count, sentence_file: searchReplaceWorkspace.sentence_file, step: searchReplaceWorkspace.step, sentence_file_full_path: searchReplaceWorkspace.sentence_file_full_path } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}

module.exports = SearchReplaceWorkspace;