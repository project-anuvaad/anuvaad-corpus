/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-12-27 16:43:41
 * @modify date 2019-12-27 16:43:41
 * @desc [description]
 */
var mongoose = require("../db/mongoose");
var Schema = mongoose.Schema;
var LOG = require('../logger/logger').logger

var MTWorkspaceSchema = new Schema({
    title: { type: String },

}, { strict: false });
var MTWorkspace = mongoose.model('mt_workspace', MTWorkspaceSchema);

MTWorkspace.save = function (mtWorkspaces, cb) {
    MTWorkspace.collection.insertMany(mtWorkspaces, function (err, docs) {
        if (err) {
            return cb(err, null)
        } else {
            LOG.info('%s MTWorkspace was successfully stored.', JSON.stringify(docs));
            return cb(null, docs)
        }
    })
}

MTWorkspace.findByCondition = function (condition, pagesize, pageno, cb) {
    MTWorkspace.find(condition, {}, (pagesize && pageno ? { skip: (pageno - 1) * pagesize, limit: parseInt(pagesize), sort: {'_id': -1} } : {sort: {'_id': -1}}), function (err, data) {
        if (err) {
            LOG.error("Unable to find MTWorkspace due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, data);
    })
}

MTWorkspace.updateMTWorkspace = function (mtWorkspace, cb) {
    MTWorkspace.collection.updateOne({ _id: mongoose.Types.ObjectId(mtWorkspace._id) }, { $set: { status: mtWorkspace.status } }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}

module.exports = MTWorkspace;