/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-12-10 16:43:41
 * @modify date 2019-12-10 16:43:41
 * @desc [description]
 */
var mongoose = require("../db/mongoose");
var Schema = mongoose.Schema;
var LOG = require('../logger/logger').logger

var ParagraphWorkspaceSchema = new Schema({
    title: { type: String },
    config_file_location: { type: String },
    paragraph_file_location: { type: String },

}, { strict: false });
var ParagraphWorkspace = mongoose.model('paragraph_workspace', ParagraphWorkspaceSchema);

ParagraphWorkspace.save = function (paragraphWorkspaces, cb) {
    ParagraphWorkspace.collection.insertMany(paragraphWorkspaces, function (err, docs) {
        if (err) {
            return cb(err, null)
        } else {
            LOG.info('%s paragraphWorkspaces was successfully stored.', JSON.stringify(docs));
            return cb(null, docs)
        }
    })
}

ParagraphWorkspace.findByCondition = function (condition, pagesize, pageno, cb) {
    ParagraphWorkspace.find(condition, {}, (pagesize && pageno ? { skip: (pageno - 1) * pagesize, limit: parseInt(pagesize), sort: {'_id': -1} } : {sort: {'_id': -1}}), function (err, data) {
        if (err) {
            LOG.error("Unable to find ParagraphWorkspace due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        LOG.info("[%s] ParagraphWorkspace found", data);
        return cb(null, data);
    })
}

ParagraphWorkspace.updateParagraphWorkspace = function (paragraphWorkspace, cb) {
    ParagraphWorkspace.collection.updateOne({ _id: mongoose.Types.ObjectId(paragraphWorkspace._id) }, { $set: { status: paragraphWorkspace.status,sentence_count: paragraphWorkspace.sentence_count, sentence_file: paragraphWorkspace.sentence_file, step: paragraphWorkspace.step, token_file: paragraphWorkspace.token_file, token_count: paragraphWorkspace.token_count, negative_token_file: paragraphWorkspace.negative_token_file, negative_token_count: paragraphWorkspace.negative_token_count } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}

module.exports = ParagraphWorkspace;