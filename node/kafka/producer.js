var APP_CONFIG = require('../config/config').config
var LOG = require('../logger/logger').logger


var Producer = (function () {
    var instance;

    function init() {
        return {
            getProducer: function (cb) {
                // var topicsToCreate = [{
                //     kafkaHost: APP_CONFIG.KAFKA_URL,
                //     host: APP_CONFIG.KAFKA_URL,
                //     topic: 'tokenext',
                //     partitions: 1,
                //     replicationFactor: 1
                // }]
                var kafka = require('kafka-node'),
                    Producer = kafka.Producer,
                    client = new kafka.KafkaClient({ kafkaHost: process.env.KAFKA_IP_HOST ? process.env.KAFKA_IP_HOST  : APP_CONFIG.KAFKA_URL }),
                    producer = new Producer(client);
                // client.createTopics(topicsToCreate, (error, result) => {
                //     LOG.error(error)
                //     LOG.debug(result)
                // });
                producer.on('ready', function () {
                    cb(null, producer)
                });

                producer.on('error', function (err) {
                    cb(err, null)
                })
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


module.exports = Producer;