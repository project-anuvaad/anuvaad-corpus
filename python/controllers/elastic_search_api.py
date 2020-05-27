"""
 * @author ['iostream04']
"""
import logging
from datetime import datetime
import time
import os
from flask import Blueprint, request, current_app as app
from models.response import CustomResponse
from models.status import Status
import elastic_utils.constant as constants
from kafka_utils.producer import get_producer

log = logging.getLogger('file')

indexer_api = Blueprint('indexer_api', __name__)

TOPIC_CORPUS_CREATION = 'create-corpus'
producer = get_producer()

# {'name': 'Bengali', 'language': 'bn'},
# {'name': 'Gujarati', 'language': 'gu'},
# {'name': 'Hindi', 'language': 'hi'},
# {'name': 'Kannada', 'language': 'kn'},
# {'name': 'Marathi', 'language': 'mr'},
# {'name': 'Punjabi', 'language': 'pa'},
# {'name': 'Tamil', 'language': 'ta'},
# {'name': 'Telugu', 'language': 'te'}
# {'name': 'Malayalam', 'language': 'ml'}
# {'name': 'Urdu', 'language': 'ur'}

supported_languages = ['en', 'hi', 'gu', 'mr', 'bn', 'kn', 'pa', 'ta', 'te', 'ml','ur']
supported_source_languages = ['en']


@indexer_api.route('/upload-corpus', methods=['POST'])
def upload_corpus():
    start_time = int(round(time.time() * 1000))
    log.info('upload_corpus: started at ' + str(start_time))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    req_data = request.get_json()
    validate_upload_corpus_request(req_data)

    lang_1 = req_data['lang_1']
    lang_2 = req_data['lang_2']
    created_by = req_data['created_by']
    created_date = current_time
    # sentence is array of objects {src:'',tar:''}
    sentences = req_data['sentences']
    domain = req_data[constants.DOMAIN]
    no_of_sentences = len(sentences)
    parallel_corpus_id = ''

    try:
        parallel_corpus_id = req_data[constants.parallel_corpus_id]
    except Exception as e:
        log.info('upload_corpus :  parallel corpus id is NOT present')

    for sen in sentences:
        data = {constants.text_lang_1: sen['src'], constants.text_lang_2: sen['tar'],
                constants.lang_1: lang_1, constants.lang_2: lang_2,
                constants.parallel_corpus_id: parallel_corpus_id,
                constants.created_by: created_by, constants.created_date: created_date,
                constants.DOMAIN: domain}
        msg = {'data': data}
        producer.send(TOPIC_CORPUS_CREATION, value=msg)
        producer.flush()

    res = CustomResponse(Status.SUCCESS.value, 'no. of sentences are ' + str(no_of_sentences))
    end_time = int(round(time.time() * 1000))
    log.info('upload_corpus: ended at ' + str(end_time) + 'total time elapsed = ' + str(end_time - start_time))
    return res.getres()


@indexer_api.route('/update-corpus', methods=['POST'])
def update_corpus():
    start_time = int(round(time.time() * 1000))
    log.info('update_corpus: started at ' + str(start_time))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    req_data = request.get_json()
    validate_upload_corpus_request(req_data)
    res = CustomResponse(Status.SUCCESS.value, 'no. of sentences are ')
    end_time = int(round(time.time() * 1000))
    log.info('upload_corpus: ended at ' + str(end_time) + 'total time elapsed = ' + str(end_time - start_time))
    return res.getres()


def validate_update_corpus_request(data):
    validate_mandatory_parameter(data, 'sentences', list)
    sentences = data['sentences']
    for sentence in sentences:
        validate_sentence_update(sentence)


def validate_sentence_update(data):
    validate_mandatory_parameter(data, 'updated_by', str)
    validate_mandatory_parameter(data, '_id', str)
    validate_parameter(data, 'parallel_corpus_id', str)
    validate_parameter(data, 'metadata', dict)


def validate_upload_corpus_request(data):
    validate_mandatory_parameter(data, 'created_by', str)
    validate_mandatory_parameter(data, 'lang_1', str)
    validate_mandatory_parameter(data, 'lang_2', str)
    validate_mandatory_parameter(data, 'sentences', list)
    validate_mandatory_parameter(data, 'domain', str)
    validate_parameter(data, 'parallel_corpus_id', str)
    validate_language_pair(data)


def validate_language_pair(data):
    lang_1 = data[constants.lang_1]
    lang_2 = data[constants.lang_2]
    if supported_languages.__contains__(lang_1) and supported_languages.__contains__(lang_2):
        if not supported_source_languages.__contains__(lang_1):
            raise Exception('source language must be from supported source language {} , provided lang is {} '
                            .format(str(supported_source_languages), lang_1))
    else:
        raise Exception('language pair must be from supported language pair {} , provided lang pairs is {} and {}'
                        .format(str(supported_languages), lang_1, lang_2))


def validate_mandatory_parameter(data, key, type_):
    try:
        value = data[key]
        if value is None:
            raise Exception('{} must be a {}, but was: {}'.format(key, type_, None))
        if not isinstance(value, type_):
            raise Exception('{} must be a {}, but was: {}'.format(key, type_, type(value)))
    except Exception as e:
        log.info('validate_mandatory_parameter : error occurred for ' + key + ', error is ' + str(e))
        raise Exception('{} must be a {}, but was: {}, please provide a valid value '.format(key, type_, None))


def validate_parameter(data, key, type_):
    try:
        value = data[key]
        if value is None:
            raise Exception('{} must be a {}, but was: {}'.format(key, type_, value))
        if type_ is str and value is '':
            raise Exception('{} must be a valid string, but was empty'.format(key))
    except Exception as e:
        log.info('validate_parameter : error occurred for ' + key + ', error is ' + str(e))
        pass
