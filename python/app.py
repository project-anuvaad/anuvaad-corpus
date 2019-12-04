"""
 * @author ['aroop','github.com/iostream04']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
from flask import Flask, jsonify, request
import os
import glob
from datetime import datetime
import time
import logging
import json
import uuid

import threading
import flask as flask

from flask_cors import CORS
from models.status import Status
from models.response import CustomResponse
from logging.config import dictConfig
from db.conmgr_mongo import connectmongo
from utils.translatewithgoogle import translatesinglesentence
from utils.translatewithanuvada_eng import translatewithanuvadaeng
from models.sentence_log import Sentencelog
from models.translation import Translation
from models.translation_process import TranslationProcess
from models.sentence import Sentence
from models.corpus import Corpus
from models.benchmark import Benchmark
from controllers.admin_api import admin_api
from controllers.corpus import corpus_api
from controllers.document_api import document_api
from utils.document_assembler import keep_on_running


""" Logging Config, for debug logs please set env 'app_debug_logs' to True  """
dictConfig({
    'version': 1,
    'formatters': {'default': {
        'format': '[%(asctime)s] {%(filename)s:%(lineno)d} %(threadName)s %(levelname)s in %(module)s: %(message)s',
    }},

    'handlers': {
        'info': {
            'class': 'logging.FileHandler',
            'level': 'DEBUG',
            'formatter': 'default',
            'filename': 'info.log'

        },
        'console': {
            'class': 'logging.StreamHandler',
            'level': 'DEBUG',
            'formatter': 'default',
            'stream': 'ext://sys.stdout',
        }
    },
    'loggers': {

        'file': {
            'level': 'DEBUG',
            'handlers': ['info', 'console'],
            'propagate': ''
        }
    },

    'root': {
        'level': 'DEBUG',
        'handlers': ['info', 'console']
    }
})

LANGUAGES = {
    'Hindi': 'hi',
    'English': 'en',
    'Bengali':'bn',
    'Gujarati':'gu',
    'Marathi':'mr',
    'Kannada':'kn',
    'Telugu':'te',
    'Malayalam':'ml',
    'Punjabi':'pa',
    'Tamil': 'ta'
}

app = Flask(__name__)

CORS(app)

app.register_blueprint(corpus_api)
app.register_blueprint(admin_api)
app.register_blueprint(document_api)

UPLOAD_FOLDER = 'upload'
STATUS_PENDING = 'PENDING'
STATUS_PROCESSING = 'PROCESSING'
STATUS_PROCESSED = 'COMPLETED'
STATUS_EDITED = 'EDITED'
ES_SERVER_URL = 'http://localhost:9876/'
PROFILE_REQ_URL = ES_SERVER_URL + 'users/'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
words = []
connectmongo()


log = logging.getLogger('file')

try:
    app_debug_logs = os.environ['app_debug_logs']

    if app_debug_logs == 'False':
        logging.disable(logging.DEBUG)
        log.info("DEBUG LOGS InACTIVE")
    else:
        log.info("DEBUG LOGS ACTIVE")
except:
    logging.disable(logging.DEBUG)
    log.info("DEBUG LOGS InACTIVE")

try:
    t1 = threading.Thread(target=keep_on_running, name='keep_on_running')
    t1.start()
    # t2 = threading.Thread(target=write_document, name='write_document')
    # t2.start()
    # t3 = threading.Thread(target=sentence_creator, name='sentence_creator')
    # t3.setDaemon(True)
    # t3.start()
except Exception as e:
    log.info('ERROR WHILE RUNNING CUSTOM THREADS '+str(e))


@app.route('/hello', methods=['GET'])
def hello_():
    log.info('testing info log')
    log.debug('testing debug logs')
    log.error('test error logs')
    return "hello"


""" to get list of corpus available """


@app.route('/fetch-corpus', methods=['GET'])
def fetch_corpus():
    if request.headers.get('ad-userid') is not None:
        log.info('fetch_corpus: initiated by ' + request.headers.get('ad-userid'))
    else:
        log.info('fetch_corpus: initiated by anonymous user')
    corpus = Corpus.objects.to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(corpus))
    return res.getres()


""" to get all the process from mongo in order of insertion """


@app.route('/fetch-translation-process', methods=['GET'])
def fetch_translation_process():
    log.info('fetch_translation_process : started at ' + str(getcurrenttime()))
    try:
        transalationProcess = TranslationProcess.objects(created_by=request.headers.get('ad-userid')).order_by(
            '-basename').to_json()
        res = CustomResponse(Status.SUCCESS.value, json.loads(transalationProcess))
    except:
        log.info('fetch-translation-process : ERROR occured')
        pass
    log.info('fetch_translation_process : ended at ' + str(getcurrenttime()))
    return res.getres()


@app.route('/fetch-translation', methods=['GET'])
def fetch_translation():
    basename = request.args.get('basename')
    sentences = Translation.objects(basename=basename).to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(sentences))
    return res.getres()


""" for translating source """


@app.route('/translate-source', methods=['GET'])
def translate_source():
    sources = []
    source = request.args.get('source')
    basename = request.args.get('basename')
    if source is None or basename is None:
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    sources.append(source)
    corpus_obj = Corpus.objects(basename=basename)
    corpus_dict = json.loads(corpus_obj.to_json())
    target_lang = 'en'
    if 'target_lang' in corpus_dict[0] and corpus_dict[0]['target_lang'] is not None:
        target_lang = LANGUAGES[corpus_dict[0]['target_lang']]
    translation_list = translatesinglesentence(sources, target_lang)
    res = CustomResponse(Status.SUCCESS.value, translation_list)
    return res.getres()


""" to get list of sentences for given corpus """


@app.route('/fetch-sentences', methods=['GET'])
def fetch_sentences():
    global LANGUAGES
    basename = request.args.get('basename')
    (sentencesobj, totalcount) = Sentence.limit(request.args.get('pagesize'), basename, request.args.get('status'),
                                                request.args.get('pageno'))
    corpus_obj = Corpus.objects(basename=basename)
    corpus_dict = json.loads(corpus_obj.to_json())
    sentences_list = []
    sources = []
    if sentencesobj is not None:
        for sent in sentencesobj:
            sent_dict = json.loads(sent.to_json())
            corpus = Sentence.objects(_id=sent_dict['_id']['$oid'])
            if sent_dict['status'] == STATUS_PENDING:
                corpus.update(set__status=STATUS_PROCESSING)
            sources.append(sent_dict['source'])
        target_lang = 'en'
        if 'target_lang' in corpus_dict[0] and corpus_dict[0]['target_lang'] is not None:
            target_lang = LANGUAGES[corpus_dict[0]['target_lang']]
        translation_list = translatesinglesentence(sources, target_lang)
        index = 0
        for sent in sentencesobj:
            sent_dict = json.loads(sent.to_json())
            sent_dict['translation'] = translation_list[index]
            sentences_list.append(sent_dict)
            index += 1
            # print() 
        # for sentence in sentencesobj:
        #     # sentence.update(set__status=STATUS_PROCESSING, set__locked=True, set__locked_time=datetime.now())
        #     sentence.update(set__status=STATUS_PROCESSING)
    res = CustomResponse(Status.SUCCESS.value, sentences_list, totalcount)
    return res.getres()


""" to update sentences present in corpus """


@app.route('/update-sentences', methods=['POST'])
def update_sentences():
    body = request.get_json()
    if (body['sentences'] is None or not isinstance(body['sentences'], list)):
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    for sentence in body['sentences']:
        corpus = Sentence.objects(_id=sentence['_id']['$oid'])
        corpus_dict = json.loads(corpus.to_json())
        sentence_log = Sentencelog(source_words=corpus_dict[0]['source'].split(" "),
                                   target_words=corpus_dict[0]['target'].split(" "),
                                   source_edited_words=sentence['source'].split(" "),
                                   updated_on=datetime.now(), edited_by=request.headers.get('ad-userid'),
                                   parent_id=sentence['_id']['$oid'], target_edited_words=sentence['target'].split(" "),
                                   basename=corpus_dict[0]['basename'], source=corpus_dict[0]['source'],
                                   target=corpus_dict[0]['target'], source_edited=sentence['source'],
                                   target_edited=sentence['target'])
        sentence_log.save()
        corpus.update(set__source=sentence['source'], set__target=sentence['target'], set__status=STATUS_EDITED)
    res = CustomResponse(Status.SUCCESS.value, None)
    return res.getres()


""" to update sentences grade in corpus """


@app.route('/update-sentences-grade', methods=['POST'])
def update_sentences_grade():
    body = request.get_json()
    if (body['sentences'] is None or not isinstance(body['sentences'], list)):
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    for sentence in body['sentences']:
        corpus = Sentence.objects(_id=sentence['_id']['$oid'])
        corpus.update(set__rating=sentence['rating'])
    res = CustomResponse(Status.SUCCESS.value, None)
    return res.getres()


""" to update sentences status present in corpus """


@app.route('/update-sentences-status', methods=['POST'])
def update_sentences_status():
    body = request.get_json()
    if (body['sentences'] is None or not isinstance(body['sentences'], list)):
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    for sentence in body['sentences']:
        corpus = Sentence.objects(_id=sentence['_id']['$oid'])
        corpus.update(set__status=sentence['status'])
    res = CustomResponse(Status.SUCCESS.value, None)
    return res.getres()

@app.route('/remove-process', methods=['POST'])
def delete_process():
    log.info('delete_process: started at ' + str(getcurrenttime()))
    try:
        basename = request.form.getlist('processname')[0]
        log.info('delte_process : requested basename is : ' + basename)
        translationProcess = TranslationProcess.objects(basename=basename).delete()
        log.info('delete_process: ended at ' + str(getcurrenttime()))
        res = CustomResponse(Status.SUCCESS.value, basename)
    except:
        log.info('delte_process : ERROR while processing  basename  : ' + basename)
        res = CustomResponse(Status.FAILURE.value, basename)
    return res.getres()


@app.route('/upload-benchmark', methods=['POST'])
def upload_benchmark_file():
    basename = str(int(time.time()))
    assign_to = ''
    if request.headers.get('ad-userid') is not None:
        assign_to
    try:
        name = request.form.getlist('name')
        source_lang = request.form.getlist('source_lang')
        if source_lang is None or len(
                source_lang) == 0 or len(source_lang[0]) == 0 or name is None or len(name) == 0 or len(
            name[0]) == 0 or request.files is None or \
                request.files['file'] is None:
            res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
            return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']

        else:
            current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            corpus = Benchmark(source_lang=source_lang[0], status=STATUS_PROCESSING,
                            name=name[0], created_on=current_time,assigned_to=request.headers.get('ad-userid'),
                            last_modified=current_time, author='', no_of_sentences=0,
                            basename=basename)
            corpus.save()
            f_eng = request.files['file']
            filepath_eng = os.path.join(
                app.config['UPLOAD_FOLDER'], basename + '_eng_filtered.txt')
            f_eng.save(filepath_eng)
            # f = request.files['hindi']
            # filepath = os.path.join(
            #     app.config['UPLOAD_FOLDER'], basename + '_hin_filtered.txt')
            # f.save(filepath)

            # translatewithanuvadaeng(app.config['UPLOAD_FOLDER'] +
            #             '/'+basename+'_eng_filtered.txt', app.config['UPLOAD_FOLDER'] +
            #             '/'+basename+'_hin_filtered.txt', model_id[0])
            # target_lang = LANGUAGES[target_lang[0]]
            # translatewithgoogle(app.config['UPLOAD_FOLDER'] +
            #             '/'+basename+'_eng_filtered.txt', app.config['UPLOAD_FOLDER'] +
            #             '/'+basename+'_hin_filtered.txt', target_lang)

            # os.system('./helpers/bleualign.py -s ' + os.getcwd() + '/upload/' + basename + '_hin_filtered' + '.txt'
            # + ' -t ' + os.getcwd() + '/upload/' + basename + '_eng_filtered' + '.txt' + ' --srctotarget ' +
            # os.getcwd() + '/upload/' + basename + '_eng_tran' + '.txt' + ' -o ' + os.getcwd() + '/upload/' +
            # basename + '_output')
            english_res = []
            # f_eng = open(app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng_filtered.txt', 'r')
            error = False
            error_messages = 'Error came for Sentences'
            with open(app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng_filtered.txt', 'rb') as f:
            # for f in f_eng:
                flist = f.readlines()
                index = 1
                for f_data in flist:
                    try:
                        if f_data.decode("utf8") != '\n' and len(f_data.decode("utf8")) > 0:
                            index = index + 1
                            english_res.append(f_data.decode("utf8"))
                    except Exception as e:
                        error = True
                        error_messages = error_messages +' '+str(index)
                        index = index + 1
            # f_eng.close()
            data = {'english': english_res}
            sentences = []
            for i in range(0, len(english_res)):
                sentence = Sentence(sentenceid=str(uuid.uuid4()), status=STATUS_PENDING, basename=str(
                    basename), source=english_res[i])
                try:
                    sentence.save()
                except Exception as e:
                    error = True
                    error_messages = error_messages+' '+english_res[i]
                # sentences.append(sentence)
                # sentence.save()
            # Sentence.objects.insert(sentences)
            for f in glob.glob(app.config['UPLOAD_FOLDER'] + '/' + basename + '*'):
                os.remove(f)
            res = None
            log.info(error)
            if error:
                res = {}
                res = Status.ERR_GLOBAL_SYSTEM.value
                res['why'] = error_messages
                # res = CustomResponse(Status.ERR_GLOBAL_SYSTEM.value, error_messages)
                return jsonify(res),500
            else:
                res = CustomResponse(Status.SUCCESS.value, data)
            corpus = Benchmark.objects(basename=basename)
            corpus.update(set__status=STATUS_PROCESSED,
                          set__no_of_sentences=len(english_res))
            return res.getres()
    except Exception as e:
        print(e)
        res = CustomResponse(Status.ERR_GLOBAL_SYSTEM.value, None)
        return res.getres(), Status.ERR_GLOBAL_SYSTEM.value['http']['status']



@app.route('/indian-kanoon', methods=['POST'])
def upload_indian_kannon_file():
    basename = str(int(time.time()))
    try:
        name = request.form.getlist('name')
        domain = request.form.getlist('domain')
        source_lang = request.form.getlist('source_lang')
        target_lang = request.form.getlist('target_lang')
        model_id = request.form.getlist('model_id')
        comment = request.form.getlist('comment')
        if comment is None or len(comment) == 0:
            comment = ['']
        if target_lang is None or len(target_lang) == 0 or len(target_lang[0]) == 0 or source_lang is None or len(
                source_lang) == 0 or len(source_lang[0]) == 0 or name is None or len(name) == 0 or len(
            name[0]) == 0 or domain is None or len(domain) == 0 or len(domain[0]) == 0 or request.files is None or \
                request.files['english'] is None:
            res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
            return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']

        else:
            current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            corpus = Corpus(source_lang=source_lang[0], target_lang=target_lang[0], status=STATUS_PROCESSING,
                            name=name[0], domain=domain[0], created_on=current_time,
                            last_modified=current_time, author='', comment=comment[0], no_of_sentences=0,
                            basename=basename)
            corpus.save()
            f_eng = request.files['english']
            filepath_eng = os.path.join(
                app.config['UPLOAD_FOLDER'], basename + '_eng_filtered.txt')
            f_eng.save(filepath_eng)
            # f = request.files['hindi']
            # filepath = os.path.join(
            #     app.config['UPLOAD_FOLDER'], basename + '_hin_filtered.txt')
            # f.save(filepath)

            translatewithanuvadaeng(app.config['UPLOAD_FOLDER'] +
                        '/'+basename+'_eng_filtered.txt', app.config['UPLOAD_FOLDER'] +
                        '/'+basename+'_hin_filtered.txt', model_id[0])
            # target_lang = LANGUAGES[target_lang[0]]
            # translatewithgoogle(app.config['UPLOAD_FOLDER'] +
            #             '/'+basename+'_eng_filtered.txt', app.config['UPLOAD_FOLDER'] +
            #             '/'+basename+'_hin_filtered.txt', target_lang)

            # os.system('./helpers/bleualign.py -s ' + os.getcwd() + '/upload/' + basename + '_hin_filtered' + '.txt'
            # + ' -t ' + os.getcwd() + '/upload/' + basename + '_eng_filtered' + '.txt' + ' --srctotarget ' +
            # os.getcwd() + '/upload/' + basename + '_eng_tran' + '.txt' + ' -o ' + os.getcwd() + '/upload/' +
            # basename + '_output')
            english_res = []
            hindi_res = []
            f_eng = open(app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng_filtered.txt', 'r')
            for f in f_eng:
                english_res.append(f)
            f_eng.close()
            f_hin = open(app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin_filtered.txt', 'r')
            for f in f_hin:
                hindi_res.append(f)
            f_hin.close()
            data = {'hindi': hindi_res, 'english': english_res}
            sentences = []
            for i in range(0, len(hindi_res)):
                sentence = Sentence(sentenceid=str(uuid.uuid4()), status=STATUS_PENDING, basename=str(
                    basename), source=english_res[i], target=hindi_res[i])
                sentences.append(sentence)
                # sentence.save()
            Sentence.objects.insert(sentences)
            for f in glob.glob(app.config['UPLOAD_FOLDER'] + '/' + basename + '*'):
                os.remove(f)
            res = CustomResponse(Status.SUCCESS.value, data)
            corpus = Corpus.objects(basename=basename)
            corpus.update(set__status=STATUS_PROCESSED,
                          set__no_of_sentences=len(hindi_res))
            return res.getres()
    except Exception as e:
        print(e)
        res = CustomResponse(Status.ERR_GLOBAL_SYSTEM.value, None)
        return res.getres(), Status.ERR_GLOBAL_SYSTEM.value['http']['status']


def getcurrenttime():
    return int(round(time.time() * 1000))


if __name__ == '__main__':

    app.run(host='0.0.0.0', port=5001)
