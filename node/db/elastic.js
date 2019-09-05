/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-09-04 16:39:57
 * @modify date 2019-09-04 16:39:57
 * @desc [description]
 */



const { Client } = require('@elastic/elasticsearch')
var config = require('../config/config').config;
var LOG = require('../logger/logger').logger;


var client = new Client({ node: config.ELASTIC_URL })

module.exports = client;