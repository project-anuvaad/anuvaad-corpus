/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-05-24 16:39:57
 * @modify date 2019-05-24 16:39:57
 * @desc [description]
 */


var mongoose = require('mongoose');
var config = require('../config/config').config;
var LOG = require('../logger/logger').logger;


mongoose.connect(process.env.MONGO_URL ? process.env.MONGO_URL : config.MONGO_URL, function (err) {
    if (err) {
        LOG.error(err)
        process.exit(0);
    }
});
module.exports = mongoose;

mongoose.connection.on('connected', function () {
    LOG.debug('Mongoose connected to ' + (process.env.MONGO_URL ? process.env.MONGO_URL : config.MONGO_URL));
});

mongoose.set('debug', function (coll, method, query, doc) {
    
});