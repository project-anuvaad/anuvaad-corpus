/*
 * @file: logger.js
 * @author: KD
 * @desc: using log4s, enables application wide logging.
 */
var APP_CONFIG      = require('../config/config').config
var log4js          = require('log4js');
var path            = require('path');
var logdir          = path.join(__dirname, '../../');
var logconfig       = require('../config/log/log4js.json', { cwd: logdir });

logconfig["appenders"]["app"]["filename"] = APP_CONFIG.LOG_DIRECTORY
log4js.configure(logconfig);

var logger          = log4js.getLogger('api');

var getLogger = function() {
    return logger;
};

exports.logger = getLogger();
