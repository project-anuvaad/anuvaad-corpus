var APP_CONFIG = require('../config/config').config
var LOG = require('../logger/logger').logger


var KafkaConsumer = (function () {
    var instance;

    function init() {
        return {
            getConsumer: function (cb) {

                var kafka = require('kafka-node')
                var options = {
                    kafkaHost: process.env.KAFKA_IP_HOST ? process.env.KAFKA_IP_HOST  : APP_CONFIG.KAFKA_URL, // connect directly to kafka broker (instantiates a KafkaClient)
                    batch: undefined, // put client batch settings if you need them
                    ssl: true, // optional (defaults to false) or tls options hash
                    sessionTimeout: 15000,
                    // An array of partition assignment protocols ordered by preference.
                    // 'roundrobin' or 'range' string for built ins (see below to pass in custom assignment protocol)
                    protocol: ['roundrobin'],
                    encoding: 'utf8', // default is utf8, use 'buffer' for binary data

                    // Offsets to use for new groups other options could be 'earliest' or 'none' (none will emit an error if no offsets were saved)
                    // equivalent to Java client's auto.offset.reset
                    fromOffset: 'latest', // default
                    commitOffsetsOnFirstJoin: true, // on the very first time this consumer group subscribes to a topic, record the offset returned in fromOffset (latest/earliest)
                    // how to recover from OutOfRangeOffset error (where save offset is past server retention) accepts same value as fromOffset
                    outOfRangeOffset: 'earliest', // default
                    // Callback to allow consumers with autoCommit false a chance to commit before a rebalance finishes
                    // isAlreadyMember will be false on the first connection, and true on rebalances triggered after that
                    onRebalance: (isAlreadyMember, callback) => { callback(); } // or null
                };

                var consumerGroup = new kafka.ConsumerGroup(options, 'tokenprocessed');
                cb(null, consumerGroup)
            },
            getErrorConsumer: function (cb) {

                var kafka = require('kafka-node')
                var options = {
                    kafkaHost: process.env.KAFKA_IP_HOST ? process.env.KAFKA_IP_HOST  : APP_CONFIG.KAFKA_URL, // connect directly to kafka broker (instantiates a KafkaClient)
                    batch: undefined, // put client batch settings if you need them
                    ssl: true, // optional (defaults to false) or tls options hash
                    sessionTimeout: 15000,
                    // An array of partition assignment protocols ordered by preference.
                    // 'roundrobin' or 'range' string for built ins (see below to pass in custom assignment protocol)
                    protocol: ['roundrobin'],
                    encoding: 'utf8', // default is utf8, use 'buffer' for binary data

                    // Offsets to use for new groups other options could be 'earliest' or 'none' (none will emit an error if no offsets were saved)
                    // equivalent to Java client's auto.offset.reset
                    fromOffset: 'latest', // default
                    commitOffsetsOnFirstJoin: true, // on the very first time this consumer group subscribes to a topic, record the offset returned in fromOffset (latest/earliest)
                    // how to recover from OutOfRangeOffset error (where save offset is past server retention) accepts same value as fromOffset
                    outOfRangeOffset: 'earliest', // default
                    // Callback to allow consumers with autoCommit false a chance to commit before a rebalance finishes
                    // isAlreadyMember will be false on the first connection, and true on rebalances triggered after that
                    onRebalance: (isAlreadyMember, callback) => { callback(); } // or null
                };

                var consumerGroup = new kafka.ConsumerGroup(options, 'toolerror');
                cb(null, consumerGroup)
            }
        }

    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = init();
            }
            return instance;
        }
    }
})();


module.exports = KafkaConsumer;