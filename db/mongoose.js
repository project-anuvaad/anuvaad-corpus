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


mongoose.connect(config.MONGO_URL);
module.exports = exports = mongoose;

mongoose.connection.on('connected', function () {
    LOG.info('Mongoose connected to ' + config.MONGO_URL);
});