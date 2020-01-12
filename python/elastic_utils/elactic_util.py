from datetime import datetime
import logging
from elastic_utils.elastic_Search_factory import get_elastic_search_client
from elastic_utils.constant import *
from elasticsearch import helpers


log = logging.getLogger('file')
client = get_elastic_search_client()


def create_index(index_name, request_body):
    if request_body is None:
        request_body = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0
            }
        }
    try:
        res = client.indices.create(index=index_name, body=request_body)
        log.info('create_index : index name = ' + index_name + ' and requestBody = '
                 + str(request_body) + 'acknowledged ' + str(res['acknowledged']))
        return res['acknowledged']
    except Exception as e:
        log.error('create_index : ERROR OCCURRED for index name= ' + index_name + 'with request = ' + str(request_body))
        return False


def create_dashboard_report(report, report_index):
    try:
        result = client.index(index=report_index,
                              body=report)
        log.info('create_sentence : sentence create with id = ' + result['_id'] + ' at index = ' + report_index)
        return result['_id']
    except Exception as e:
        log.error('create_dashboard_report: ERROR OCCURRED WHILE CREATING REPORT: for doc : ' +
                  str(report) + ' at index : ' + report_index)
        raise e

def create_sentence(sentence, sentence_index):
    sentence = validate_create_sentence(sentence)

    try:
        result = client.index(index=sentence_index,
                              body={text_lang_1: sentence[text_lang_1], text_lang_2: sentence[text_lang_2],
                                    parallel_corpus_id: sentence[parallel_corpus_id],
                                    lang_1: sentence[lang_1], created_date: sentence[created_date],
                                    lang_2: sentence[lang_2], created_by: sentence[created_by], DOMAIN: sentence[DOMAIN]})
        log.info('create_sentence : sentence create with id = ' + result['_id'] + ' at index = ' + sentence_index)
        return result['_id']
    except Exception as e:
        log.error('create_sentence: ERROR OCCURRED WHILE CREATING SENTENCE: for sentence : ' +
                  str(sentence) + ' at index : ' + sentence_index)
        raise e


def update_sentence(_id, sentence, sentence_index):
    log.info('update_sentence : _id = ' + _id + ' update_data = ' + sentence)
    sen = validate_update_sentence(sentence)
    try:
        result = client.update(index=sentence_index, id=_id, body={'doc': sen})
        if result['result'] == 'updated':
            return True
        else:
            return False

    except Exception as e:
        log.error('create_sentence: ERROR OCCURRED WHILE CREATING SENTENCE : for sentence : ' +
                  str(sentence) + ' at index : ' + sentence_index)
        raise e


def bulk_insert(data, index, data_type=None):
    body = []

    if data_type is SENTENCE:
        if not isinstance(data, list):
            raise Exception('data should be of type list')
        for sentence in data:
            sen = validate_create_sentence(sentence)
            body.append(get_action(index, sen))
    else:
        for doc in data:
            body.append(get_action(index, doc))

    try:
        res = helpers.bulk(client, body)

        if res is not None:
            return res[0]
        else:
            return None
    except Exception as e:
        log.error('bulk_insert : ERROR OCCURRED while bulk insertion, for index = '+index+' for body = '+ str(body))
        log.error('bulk_insert : ERROR IS = '+str(e))


def get_action(index, sen):
    action = {
        "_index": index,
        "_source": sen
    }
    return action


def validate_update_sentence(sentence):
    if not isinstance(sentence, dict):
        raise Exception('{} must be a dict, but was: {}'.format('sentence', type(sentence)))
    if sentence[text_lang_1] is not None:
        validate_is_str(sentence[text_lang_1], text_lang_1)

    if sentence[text_lang_2] is not None:
        validate_is_str(sentence[text_lang_2], text_lang_2)

    if sentence[lang_1] is not None:
        validate_is_str(sentence[lang_1], lang_1)

    if sentence[lang_2] is not None:
        validate_is_str(sentence[lang_2], lang_2)
    if sentence[metadata] is not None and not isinstance(sentence[metadata], dict):
        raise Exception('{} must be a dict, but was: {}'.format('sentence', type(sentence[metadata])))

    validate_pc_id(sentence[parallel_corpus_id])
    log.info('validate_update_sentence : sentence received :' + str(sentence))
    sen = Sentence(sentence)
    sen[metadata] = sentence[metadata]
    return sen


def validate_create_sentence(sentence):
    if not isinstance(sentence, dict):
        log.error('validate_create_sentence : for sentence' + str(sentence))
        raise Exception('{} must be a string, but was: {}'.format('sentence', type(sentence)))
    validate_is_str(sentence[text_lang_1], text_lang_1)
    validate_is_str(sentence[text_lang_2], text_lang_2)
    validate_is_str(sentence[lang_1], lang_1)
    validate_is_str(sentence[lang_2], lang_2)
    validate_is_str(sentence[created_by], created_by)
    validate_is_str(sentence[DOMAIN], DOMAIN)
    validate_pc_id(sentence[parallel_corpus_id])
    log.info('validate_create_sentence : sentence received :' + str(sentence))
    return Sentence(sentence)


def Sentence(sen):
    data = {text_lang_1: sen[text_lang_1], text_lang_2: sen[text_lang_2],
            lang_1: sen[lang_1], lang_2: sen[lang_2], parallel_corpus_id: sen[parallel_corpus_id],
            created_by: sen[created_by], created_date: datetime.now(), DOMAIN: sen[DOMAIN]}
    return data


def validate_pc_id(data):
    if data is not None and not isinstance(data, str):
        raise Exception('{} must be a string, but was: {}'.format(parallel_corpus_id, type(data)))


def validate_is_str(data, attr='text'):
    if data is None:
        raise Exception('{} must be a string, but was: {}'.format(attr, None))
    if data is not None and not isinstance(data, str):
        raise Exception('{} must be a string, but was: {}'.format(attr, type(data)))