/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2020-04-29 16:39:57
 * @modify date 2020-04-29 16:39:57
 * @desc [description]
 */

var redis = require("redis");
var config = require('../config/config').config;
var LOG = require('../logger/logger').logger;


var client = redis.createClient({
    host: process.env.REDIS_URL ? process.env.REDIS_URL : config.REDIS_URL,
    port: process.env.REDIS_PORT ? process.env.REDIS_PORT : config.REDIS_PORT,
    prefix: process.env.REDIS_PREFIX ? process.env.REDIS_PREFIX : config.REDIS_PREFIX
});
 
client.on("error", function(error) {
  LOG.error(error);
});

client.on("connect", function(error) {
    LOG.debug('redis connected to ' + (process.env.REDIS_URL ? process.env.REDIS_URL : config.REDIS_URL));
  });
 
// client.set("key", "value", redis.print);
// client.get("key", redis.print);

module.exports = client;