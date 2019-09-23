"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
from flask import Flask, jsonify, request
import os
import glob
import sys
from datetime import datetime
import time
from db.conmgr import getinstance
from db.conmgr_mongo import connectmongo
from utils.pdftoimage import converttoimage
from utils.imagetotext import convertimagetotext
from utils.imagetoalto import convertimagetoalto
from utils.puttext import puttext
from utils.removetextv2 import removetext
from utils.imagetopdf import converttopdf
from utils.translateandupdateimage import translateandupdateimage
from utils.process_paragraph import processhindi
from utils.process_paragraph_eng import processenglish
from utils.remove_page_number_filter import filtertext
from utils.separate import separate
from utils.translatewithgoogle import translatewithgoogle, translatesinglesentence
from utils.translatewithanuvada import translatewithanuvada
from utils.translatewithanuvada_eng import translatewithanuvadaeng
from models.words import savewords
from models.sentence_log import Sentencelog
from models.translation import Translation
from models.translation_process import TranslationProcess
from models.words import fetchwordsfromsentence, fetchwordhocrfromsentence
from models.sentence import Sentence
from models.corpus import Corpus
from models.old_corpus import Oldcorpus
from controllers.corpus import corpus_api
from werkzeug.utils import secure_filename
import math
import subprocess
import json
import multiprocessing as mp
import codecs
from flask_cors import CORS
from flask import Response
import flask as flask
from models.status import Status
from models.response import CustomResponse
import utils.docx_translate_helper as docx_helper
import uuid
import logging
from logging.handlers import RotatingFileHandler
import utils.modify_first_page as modify_first_page
import utils.translate_footnote as translate_footer
from logging.config import dictConfig
import requests
import db.redis_client as redis_cli
from controllers.admin_api import admin_api

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

app.debug = True
CORS(app)

app.register_blueprint(corpus_api)
app.register_blueprint(admin_api)

UPLOAD_FOLDER = 'upload'
STATUS_PENDING = 'PENDING'
STATUS_PROCESSING = 'PROCESSING'
STATUS_PROCESSED = 'COMPLETED'
STATUS_EDITED = 'EDITED'
ES_SERVER_URL = 'http://localhost:9876/'
PROFILE_REQ_URL = ES_SERVER_URL + 'users/'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
es = getinstance()
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
    totalcount = 0
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


@app.route('/translate-file', methods=['POST'])
def translateFile():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    translationProcess = TranslationProcess(
        status=STATUS_PROCESSING, name=f.filename, created_on=current_time, basename=basename)
    translationProcess.save()
    f.save(filepath)
    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'], basename, ''), callback=capturealtotext)
    pool.close()
    pool.join()

    res = CustomResponse(Status.SUCCESS.value, '')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)
    return res.getres()


@app.route('/get-file-data', methods=['POST'])
def getfiledata():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    # translationProcess = TranslationProcess(
    #     status=STATUS_PROCESSING, name=f.filename, created_on=current_time, basename=basename)
    # translationProcess.save()
    f.save(filepath)
    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'], basename, '_eng'), callback=capturetext)
    pool.close()
    pool.join()
    filtertext(app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng.txt',
               app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng_filtered.txt')
    processenglish(app.config['UPLOAD_FOLDER'] +
                   '/' + basename + '_eng_filtered.txt')
    # translatewithanuvadaeng(app.config['UPLOAD_FOLDER'] +
    #                      '/'+basename+'_hin_filtered.txt', app.config['UPLOAD_FOLDER'] +
    #                      '/'+basename+'_eng_tran.txt')
    # f_eng = open(app.config['UPLOAD_FOLDER']+'/' +
    #              basename + '_eng_filtered.txt', 'r')
    english_res = []
    # hindi_res = []
    # for f in f_eng:
    #     english_res.append(f)
    # f_eng.close()
    f_eng = open(app.config['UPLOAD_FOLDER'] + '/' +
                 basename + '_eng_filtered.txt', 'r')
    for f in f_eng:
        english_res.append(f)
    f_eng.close()
    data = {'english': english_res}
    # translations = []
    # for i in range(0, len(hindi_res)):
    #     translation = Translation(basename=str(
    #         basename), source=hindi_res[i], target=english_res[i])
    #     translations.append(translation)
    # Translation.objects.insert(translations)

    res = CustomResponse(Status.SUCCESS.value, data)
    result = flask.send_file(os.path.join('upload/', basename + '_eng_filtered.txt'), as_attachment=True)
    result.headers["x-suggested-filename"] = basename + '.txt'

    # translationProcess = TranslationProcess.objects(basename=basename)
    # translationProcess.update(set__status=STATUS_PROCESSED)
    return result


@app.route('/translate', methods=['POST'])
def translate():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    translationProcess = TranslationProcess(
        status=STATUS_PROCESSING, name=f.filename, created_on=current_time, basename=basename)
    translationProcess.save()
    f.save(filepath)
    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'], basename, '_hin'), callback=capturetext)
    pool.close()
    pool.join()
    filtertext(app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin.txt',
               app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin_filtered.txt')
    processenglish(app.config['UPLOAD_FOLDER'] +
                   '/' + basename + '_hin_filtered.txt')
    translatewithanuvadaeng(app.config['UPLOAD_FOLDER'] +
                            '/' + basename + '_hin_filtered.txt', app.config['UPLOAD_FOLDER'] +
                            '/' + basename + '_eng_tran.txt')
    f_eng = open(app.config['UPLOAD_FOLDER'] + '/' +
                 basename + '_eng_tran.txt', 'r')
    english_res = []
    hindi_res = []
    for f in f_eng:
        english_res.append(f)
    f_eng.close()
    f_hin = open(app.config['UPLOAD_FOLDER'] + '/' +
                 basename + '_hin_filtered.txt', 'r')
    for f in f_hin:
        hindi_res.append(f)
    f_hin.close()
    data = {'hindi': hindi_res, 'english': english_res}
    translations = []
    for i in range(0, len(hindi_res)):
        translation = Translation(basename=str(
            basename), source=hindi_res[i], target=english_res[i])
        translations.append(translation)
    Translation.objects.insert(translations)
    for f in glob.glob(app.config['UPLOAD_FOLDER'] + '/' + basename + '*'):
        os.remove(f)
    res = CustomResponse(Status.SUCCESS.value, data)
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)
    return res.getres()


@app.route('/download-docx', methods=['GET'])
def downloadDocx():
    filename = request.args.get('filename')
    result = flask.send_file(os.path.join('upload/', filename), as_attachment=True)
    result.headers["x-suggested-filename"] = filename
    return result

@app.route('/batch-sentences', methods=['GET'])
def batchsentences():
    basename = request.args.get('basename')
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    sentences = Sentence.objects(basename=basename)
    corpus_obj = Corpus.objects(basename=basename)
    index = 2
    batch_size = 10000
    if len(sentences) > batch_size:
        for i in range(2,1+math.ceil(len(sentences)/batch_size)):
            base = str(uuid.uuid4())
            if (i)*batch_size > len(sentences):
                sentence_batch = sentences[0:(i-1)*batch_size-len(sentences)]
                print(len(sentence_batch))
                if len(sentence_batch)>0:
                    corpus = Corpus(source_lang='English', target_lang='Hindi', status=STATUS_PROCESSED,
                                name='SC Judgment 2019 Batch '+str(index), domain='LAW', created_on=current_time,
                                last_modified=current_time, author='', comment='', no_of_sentences=len(sentence_batch),
                                basename=base)
                    corpus.save()
                    
                    for sentence in sentence_batch:
                        sentence_dict = json.loads(sentence.to_json())
                        sen = Sentence.objects(_id=sentence_dict['_id']['$oid'])
                        print(sen.to_json())
                        sen.update(set__basename=base)
            else:
                sentence_batch = sentences[0:batch_size]
                print(len(sentence_batch))
                if len(sentence_batch)>0:
                    corpus = Corpus(source_lang='English', target_lang='Hindi', status=STATUS_PROCESSED,
                                name='SC Judgment 2019 Batch '+str(index), domain='LAW', created_on=current_time,
                                last_modified=current_time, author='', comment='', no_of_sentences=len(sentence_batch),
                                basename=base)
                    corpus.save()
                    for sentence in sentence_batch:
                        sentence_dict = json.loads(sentence.to_json())
                        sen = Sentence.objects(_id=sentence_dict['_id']['$oid'])
                        print(sen.to_json())
                        sen.update(set__basename=base)
            index+=1
    res = CustomResponse(Status.FAILURE.value, basename)
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


@app.route('/translate-docx', methods=['POST'])
def translateDocx():
    start_time = int(round(time.time() * 1000))
    log.info('translateDocx: started at ' + str(start_time))
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.docx')

    sourceLang = request.form.getlist('sourceLang')[0]
    model_meta_data = request.form.getlist('model')[0]
    log.info('model meta data'+model_meta_data)
    model_obj = json.loads(model_meta_data)
    url_end_point = 'translation_en'
    model_id = int(model_obj['model_id'])
    if 'url_end_point' in model_obj:
        url_end_point = model_obj['url_end_point']
    targetLang = request.form.getlist('targetLang')[0]
    translationProcess = TranslationProcess(created_by=request.headers.get('ad-userid'),
                                            status=STATUS_PROCESSING, name=f.filename, created_on=current_time,
                                            basename=basename, sourceLang=sourceLang, targetLang=targetLang)
    translationProcess.save()
    f.save(filepath)
    filename_to_processed = f.filename
    filepath_processed = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '_t' + '.docx')
    filepath_processed_src_with_ids = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '_s' + '.docx')

    log.info("translate-doxc : " + filename_to_processed)

    xml_content = docx_helper.get_document_xml(filepath)
    xmltree = docx_helper.get_xml_tree(xml_content)

    nodes = []
    texts = []
    docx_helper.add_identification_tag(xmltree, basename + '-' + str(uuid.uuid4()))
    docx_helper.warp_original_with_identification_tags(filepath, xmltree, filepath_processed_src_with_ids)
    docx_helper.pre_process_text(xmltree)

    for node, text in docx_helper.itertext(xmltree):
        nodes.append(node)
        texts.append(text)

    log.info('translateDocx: number of nodes ' + str(len(nodes)) + ' and text are : ' + str(len(texts)))

    """  method which don't use tokenization  """
    # docx_helper.modify_text(nodes)

    nodes_first_page = []
    # nodes_first_page = modify_first_page.get_first_page_nodes(nodes)
    # first_page_node_len = modify_first_page.get_size(nodes_first_page)
    # node_after_first_page = modify_first_page.get_nodes_after_f_page(nodes, first_page_node_len)
    #
    # modify_first_page.modify_text_on_first_page_using_model(nodes_first_page, model_id, url_end_point)
    docx_helper.modify_text_with_tokenization(nodes, None, model_id, url_end_point)
    xml_footer_list = translate_footer.translate_footer(filepath, model_id, url_end_point)

    docx_helper.save_docx(filepath, xmltree, filepath_processed, xml_footer_list)

    res = CustomResponse(Status.SUCCESS.value, basename + '_t' + '.docx')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)

    log.info('translateDocx: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
        getcurrenttime() - start_time))
    return res.getres()


@app.route('/translate-docx-new', methods=['POST'])
def translateDocxNew():
    _url = 'http://18.236.30.130:3003/translator/translation_en'
    start_time = int(round(time.time() * 1000))
    log.info('translateDocx-new: started at ' + str(start_time))
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.docx')

    sourceLang = request.form.getlist('sourceLang')[0]
    targetLang = request.form.getlist('targetLang')[0]
    translationProcess = TranslationProcess(created_by=request.headers.get('ad-userid'),
                                            status=STATUS_PROCESSING, name=f.filename, created_on=current_time,
                                            basename=basename, sourceLang=sourceLang, targetLang=targetLang)
    translationProcess.save()
    f.save(filepath)
    filename_to_processed = f.filename
    filepath_processed = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '_t' + '.docx')

    xml_content = docx_helper.get_document_xml(filepath)
    xmltree = docx_helper.get_xml_tree(xml_content)

    nodes = []
    texts = []
    docx_helper.add_identification_tag(xmltree, str(uuid.uuid4()))
    docx_helper.pre_process_text(xmltree)

    for node, text in docx_helper.itertext(xmltree):
        nodes.append(node)
        texts.append(text)

    log.info('translateDocx-new: number of nodes ' + str(len(nodes)) + ' and text are : ' + str(len(texts)))

    """  method which don't use tokenization  """
    # docx_helper.modify_text(nodes)

    docx_helper.modify_text_with_tokenization(nodes, _url)

    docx_helper.save_docx(filepath, xmltree, filepath_processed)

    res = CustomResponse(Status.SUCCESS.value, basename + '_t' + '.docx')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)

    log.info('translateDocx-new: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
        getcurrenttime() - start_time))
    return res.getres()


@app.route('/single', methods=['POST'])
def upload_single_file():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    corpus = Corpus(status=STATUS_PROCESSING, name=str(basename), domain='', created_on=current_time,
                    last_modified=current_time, author='', comment='', no_of_sentences=0)
    corpus.save()
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    f.save(filepath)
    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'], basename, ''), callback=capturetext)
    pool.close()
    pool.join()
    separate(app.config['UPLOAD_FOLDER'] + '/' + basename)
    return process_files(basename)


@app.route('/multiple-law', methods=['POST'])
def upload_file_law():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    try:
        current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
        f = request.files['hindi']
        f_eng = request.files['english']
        filepath = os.path.join(
            app.config['UPLOAD_FOLDER'], basename + '_hin.pdf')
        filepath_eng = os.path.join(
            app.config['UPLOAD_FOLDER'], basename + '_eng.pdf')
        f.save(filepath)
        f_eng.save(filepath_eng)
        pool.apply_async(converttoimage, args=(
            filepath, app.config['UPLOAD_FOLDER'], basename, '_hin'), callback=capturetext)
        pool.apply_async(converttoimage, args=(
            filepath_eng, app.config['UPLOAD_FOLDER'], basename, '_eng'), callback=capturetext)
        pool.close()
        pool.join()
        return process_files_law(basename, 'OLD_LAW_CORPUS')
    except Exception as e:
        print(e)
        res = CustomResponse(Status.ERR_GLOBAL_SYSTEM.value, None)
        return res.getres(), Status.ERR_GLOBAL_SYSTEM.value['http']['status']


def process_files_law(basename, name):
    filtertext(app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin.txt',
               app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin_filtered.txt')
    filtertext(app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng.txt',
               app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng_filtered.txt')
    processhindi(app.config['UPLOAD_FOLDER'] +
                 '/' + basename + '_hin_filtered.txt')
    processenglish(app.config['UPLOAD_FOLDER'] +
                   '/' + basename + '_eng_filtered.txt')
    translatewithgoogle(app.config['UPLOAD_FOLDER'] +
                        '/' + basename + '_hin_filtered.txt', app.config['UPLOAD_FOLDER'] +
                        '/' + basename + '_eng_tran.txt')
    os.system(
        './helpers/bleualign.py -s ' + os.getcwd() + '/upload/' + basename + '_hin_filtered' + '.txt' + ' -t ' + os.getcwd() + '/upload/' + basename +
        '_eng_filtered' + '.txt' + ' --srctotarget ' + os.getcwd() + '/upload/' + basename + '_eng_tran' + '.txt' + ' -o ' + os.getcwd() + '/upload/' + basename + '_output')
    english_res = []
    hindi_res = []
    english_points = []
    english_points_words = []
    hindi_points = []
    hindi_points_words = []
    f_eng = open(app.config['UPLOAD_FOLDER'] +
                 '/' + basename + '_output-t', 'r')
    for f in f_eng:
        english_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        english_points.append(point['avg'])
        english_points_words.append(point['values'])
    f_eng.close()
    f_hin = open(app.config['UPLOAD_FOLDER'] +
                 '/' + basename + '_output-s', 'r')
    for f in f_hin:
        hindi_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        hindi_points.append(point['avg'])
        hindi_points_words.append(point['values'])
    f_hin.close()
    data = {'hindi': hindi_res, 'english': english_res,
            'english_scores': english_points, 'hindi_scores': hindi_points}
    sentences = []
    for i in range(0, len(hindi_res)):
        sentence = Sentence(status=STATUS_PENDING, alignment_accuracy=english_res[i].split(':::::')[1], basename=name,
                            source=hindi_res[i], target=english_res[i].split(':::::')[0],
                            source_ocr_words=hindi_points_words[i], source_ocr=str(hindi_points[i]),
                            target_ocr_words=english_points_words[i], target_ocr=str(english_points[i]))
        sentences.append(sentence)
        # sentence.save()
    Sentence.objects.insert(sentences)
    for f in glob.glob(app.config['UPLOAD_FOLDER'] + '/' + basename + '*'):
        os.remove(f)
    res = CustomResponse(Status.SUCCESS.value, data)
    # corpus = Corpus.objects(basename=basename)
    # corpus.update(set__status=STATUS_PROCESSED,
    #               set__no_of_sentences=len(hindi_res))
    return res.getres()


@app.route('/remove-junk', methods=['POST'])
def remove_junk():
    basename = str(int(time.time()))
    f = request.files['file']
    filepath_eng = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '_junk.txt')
    f.save(filepath_eng)
    f_eng = open(app.config['UPLOAD_FOLDER'] + '/' + basename + '_junk.txt', 'r')
    for t in f_eng:
        Sentence.objects(source=t).delete()
    res = CustomResponse(Status.SUCCESS.value, None)
    return res.getres()


@app.route('/indian-kanoon', methods=['POST'])
def upload_indian_kannon_file():
    pool = mp.Pool(mp.cpu_count())
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
            # os.system('./helpers/bleualign.py -s ' + os.getcwd() + '/upload/' + basename + '_hin_filtered' + '.txt' + ' -t ' + os.getcwd() + '/upload/' + basename +
            #         '_eng_filtered' + '.txt' + ' --srctotarget ' + os.getcwd() + '/upload/' + basename + '_eng_tran' + '.txt' + ' -o ' + os.getcwd() + '/upload/' + basename + '_output')
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
                sentence = Sentence(sentenceid=str(uuid.uuid4()),status=STATUS_PENDING, basename=str(
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


@app.route('/multiple', methods=['POST'])
def upload_file():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    try:
        name = request.form.getlist('name')
        domain = request.form.getlist('domain')
        comment = request.form.getlist('comment')
        if comment is None or len(comment) == 0:
            comment = ['']
        if name is None or len(name) == 0 or len(name[0]) == 0 or domain is None or len(domain) == 0 or len(
                domain[0]) == 0 or request.files is None or request.files['hindi'] is None or request.files[
            'english'] is None:
            res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
            return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']

        else:
            current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            corpus = Corpus(status=STATUS_PROCESSING, name=name[0], domain=domain[0], created_on=current_time,
                            last_modified=current_time, author='', comment=comment[0], no_of_sentences=0,
                            basename=basename)
            corpus.save()
            f = request.files['hindi']
            f_eng = request.files['english']
            filepath = os.path.join(
                app.config['UPLOAD_FOLDER'], basename + '_hin.pdf')
            filepath_eng = os.path.join(
                app.config['UPLOAD_FOLDER'], basename + '_eng.pdf')
            f.save(filepath)
            f_eng.save(filepath_eng)
            pool.apply_async(converttoimage, args=(
                filepath, app.config['UPLOAD_FOLDER'], basename, '_hin'), callback=capturetext)
            pool.apply_async(converttoimage, args=(
                filepath_eng, app.config['UPLOAD_FOLDER'], basename, '_eng'), callback=capturetext)
            pool.close()
            pool.join()
            return process_files(basename)
    except Exception as e:
        print(e)
        res = CustomResponse(Status.ERR_GLOBAL_SYSTEM.value, None)
        return res.getres(), Status.ERR_GLOBAL_SYSTEM.value['http']['status']


def process_files(basename):
    filtertext(app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin.txt',
               app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin_filtered.txt')
    filtertext(app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng.txt',
               app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng_filtered.txt')
    processhindi(app.config['UPLOAD_FOLDER'] +
                 '/' + basename + '_hin_filtered.txt')
    processenglish(app.config['UPLOAD_FOLDER'] +
                   '/' + basename + '_eng_filtered.txt')
    translatewithgoogle(app.config['UPLOAD_FOLDER'] +
                        '/' + basename + '_hin_filtered.txt', app.config['UPLOAD_FOLDER'] +
                        '/' + basename + '_eng_tran.txt')
    os.system(
        './helpers/bleualign.py -s ' + os.getcwd() + '/upload/' + basename + '_hin_filtered' + '.txt' + ' -t ' + os.getcwd() + '/upload/' + basename +
        '_eng_filtered' + '.txt' + ' --srctotarget ' + os.getcwd() + '/upload/' + basename + '_eng_tran' + '.txt' + ' -o ' + os.getcwd() + '/upload/' + basename + '_output')
    english_res = []
    hindi_res = []
    english_points = []
    english_points_words = []
    hindi_points = []
    hindi_points_words = []
    f_eng = open(app.config['UPLOAD_FOLDER'] + '/' + basename + '_output-t', 'r')
    for f in f_eng:
        english_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        english_points.append(point['avg'])
        english_points_words.append(point['values'])
    f_eng.close()
    f_hin = open(app.config['UPLOAD_FOLDER'] + '/' + basename + '_output-s', 'r')
    for f in f_hin:
        hindi_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        hindi_points.append(point['avg'])
        hindi_points_words.append(point['values'])
    f_hin.close()
    data = {'hindi': hindi_res, 'english': english_res,
            'english_scores': english_points, 'hindi_scores': hindi_points}
    sentences = []
    for i in range(0, len(hindi_res)):
        sentence = Sentence(status=STATUS_PENDING, alignment_accuracy=english_res[i].split(':::::')[1], basename=str(
            basename), source=hindi_res[i], target=english_res[i].split(':::::')[0],
                            source_ocr_words=hindi_points_words[i], source_ocr=str(hindi_points[i]),
                            target_ocr_words=english_points_words[i], target_ocr=str(english_points[i]))
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


def capturewords(result):
    print(result)
    global words
    words.append(result)


def capturetext(result):
    words = convertimagetotext(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                               '/' + result['basename'] + result['suffix'] + '.txt', result['basename'])
    savewords(words)


def capturealtotext(result):
    convertimagetoalto(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                       '/' + result['basename'] + result['suffix'], result['basename'])
    removetext(result['imagenames'], app.config['UPLOAD_FOLDER'] +
               '/' + result['basename'] + result['suffix'])
    translateandupdateimage(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                            '/' + result['basename'] + result['suffix'])
    converttopdf(result['imagenames'])


def getcurrenttime():
    return int(round(time.time() * 1000))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
