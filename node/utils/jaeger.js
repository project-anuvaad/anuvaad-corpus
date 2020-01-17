const initJaegerTracer = require("jaeger-client").initTracer;
var LOG = require('../logger/logger').logger


function initTracer(serviceName) {
    const config = {
        serviceName: serviceName,
        reporter: {
            // Provide the traces endpoint; this forces the client to connect directly to the Collector and send
            // spans over HTTP
            collectorEndpoint: process.env.JAEGER_SERVICE ? process.env.JAEGER_SERVICE : 'http://localhost:14268/api/traces',
            // Provide username and password if authentication is enabled in the Collector
            // username: '',
            // password: '',
        },
        sampler: {
            type: "const",
            param: 1,
        },
        reporter: {
            logSpans: true,
        },
    };
    const options = {
        logger: LOG,
    };
    return initJaegerTracer(config, options);
}

module.exports = initTracer;