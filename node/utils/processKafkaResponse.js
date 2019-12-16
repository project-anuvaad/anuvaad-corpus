var LOG = require('../logger/logger').logger
const PATH_TOKENIZE = 'tokenize'

exports.processKafkaResponse = function (req) {
    LOG.info('Kafka request came with data as [%s]', JSON.stringify(req))
    if(!req.path){
        LOG.error('Kafka request path not specified for [%s]', JSON.stringify(req))
    }
    else{
        switch(req.path){
            case PATH_TOKENIZE:
                
        }
    }
}