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
        data = msg.value['data']
        log.info('sentence_creator : message received = ' + str(data))
        index = get_index_for_sentence(data)
        create_sentence(data, index)


def get_index_for_sentence(data):
    lang_1 = data['lang_1']
    lang_2 = data['lang_2']
    index = lang_1 + '-' + lang_2
    return index



