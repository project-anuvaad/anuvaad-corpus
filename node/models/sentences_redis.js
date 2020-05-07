var redis_client = require("../db/redis");
var crypto = require('crypto');
var LOG = require('../logger/logger').logger


exports.saveSentence = function (sentence, userid, cb) {
    if (sentence && sentence.source) {
        redis_client.set(userid + '_' + crypto.createHash('sha256').update(sentence.source).digest('hex'), JSON.stringify(sentence), function (err, doc) {
            if (err) {
                LOG.error(err)
                cb(err, null)
            } else {
                cb(null, doc)
            }
        });
    }else{
        cb(null, {})
    }
}

exports.fetchSentence = function (sentence, userid, cb) {
    redis_client.get(userid + '_' + crypto.createHash('sha256').update(sentence.src).digest('hex'), function (err, doc) {
        if (err) {
            LOG.error(err)
            cb(err, null)
        } else {
            cb(null, doc)
        }
    });
}
