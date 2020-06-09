var LOG = require('../logger/logger').logger
var mongoose = require("../db/mongoose");

var Basemodel = {}

Basemodel.saveData = function (schema, data, cb) {
    schema.collection.insertMany(data, function (err, docs) {
        if (err) {
            return cb(err, null);
        } else {
            return cb(null, docs);
        }
    })
}

Basemodel.updateData = function (schema, data, id, cb) {
    schema.collection.findOneAndUpdate({ _id: mongoose.Types.ObjectId(id) }, { $set: data }, { upsert: false }, function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        }
        cb(null, doc)
    });
}

Basemodel.findById = function (schema, id, cb) {
    schema.findById(id, function (err, data) {
        if (err) {
            LOG.error("Unable to find data due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, data);
    })
}

Basemodel.findByCondition = function (schema, condition, pagesize, pageno, sort_column, cb) {
    if (!sort_column) {
        sort_column = '_id'
    }
    schema.find(condition, {}, (pagesize && pageno ? { skip: (pageno - 1) * pagesize, limit: parseInt(pagesize), sort: { sort_column: -1 } } : { sort: { sort_column: -1 } }), function (err, data) {
        if (err) {
            LOG.error("Unable to find data due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, data);
    })
}

Basemodel.findByEmbeddedCondition = function (schema, condition, pagesize, pageno, sort_column, embedded_condition, cb) {
    if (!sort_column) {
        sort_column = '_id'
    }
    schema.find(condition, embedded_condition, (pagesize && pageno ? { skip: (pageno - 1) * pagesize, limit: parseInt(pagesize), sort: { sort_column: -1 } } : { sort: { sort_column: -1 } }), function (err, data) {
        if (err) {
            LOG.error("Unable to find data due to [%s]", JSON.stringify(err));
            return cb(err, null);
        }
        return cb(null, data);
    })
}


module.exports = Basemodel;