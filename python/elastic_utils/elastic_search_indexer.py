"""
 * @author ['iostream04']
"""
from kafka_utils.consumer import get_consumer
from elastic_utils.elactic_util import create_sentence
import elastic_utils.constant as constants
import logging

log = logging.getLogger('file')
TOPIC_CORPUS_CREATION = 'create-corpus'


def sentence_creator():
    consumer = get_consumer(TOPIC_CORPUS_CREATION)
    for msg in consumer:
        try:
            data = msg.value['data']
            LOG.debug('sentence_creator : message received = ' + str(data))
            if data is not None:
                index = get_index_for_sentence(data)
                create_sentence(data, index)

        except Exception as e:
            log.erro('sentence_creator:  error while processing message with exception == '+str(e))


def get_index_for_sentence(data):
    lang_1 = data['lang_1']
    lang_2 = data['lang_2']
    index = lang_1 + '-' + lang_2
    return index



