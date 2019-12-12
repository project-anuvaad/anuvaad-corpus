var APP_CONFIG = require('../config/config').config
var LOG = require('../logger/logger').logger


var Producer = (function () {
    var instance;

    function init() {
        return {
            getProducer: function (cb) {
                var kafka = require('kafka-node'),
                    Producer = kafka.Producer,
                    client = new kafka.KafkaClient({ kafkaHost: APP_CONFIG.KAFKA_URL }),
                    producer = new Producer(client);
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