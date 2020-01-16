"""
 * @author ['iostream04']
"""
# -*- coding: utf-8 -*-

from flask import Blueprint, request, current_app as app
import flask
import requests
import time
import os
import logging
from models.status import Status
from models.response import CustomResponse
import utils.docx_translate_helper as docx_helper
from models.translation_process import TranslationProcess
from models.user_high_court import Userhighcourt
from models.high_court import Highcourt
import utils.modify_first_page as modify_first_page
import utils.translate_footnote as translate_footer
from kafka_utils.producer import get_producer
from nltk.tokenize import sent_tokenize
from elastic_utils.elactic_util import create_dashboard_report
import nltk

nltk.download('punkt')
from models.text_nodes import TextNode
from models.Document_nodes import DocumentNodes
import json
import uuid
from datetime import datetime
from indicnlp.tokenize import sentence_tokenize

log = logging.getLogger('file')

document_api = Blueprint('document_api', __name__)
UPLOAD_FOLDER = 'upload'
STATUS_PENDING = 'PENDING'
STATUS_FAILED = 'FAILED'
STATUS_PROCESSING = 'PROCESSING'
STATUS_PROCESSED = 'COMPLETED'
producer = get_producer()
TOPIC = "to-nmt"
TEXT_PROCESSING_TIME = 40

GATEWAY_SERVER_URL = os.environ.get('GATEWAY_URL', 'http://localhost:9876/')
PROFILE_REQ_URL = GATEWAY_SERVER_URL + 'users/'


@document_api.route('/download-docx', methods=['GET'])
def download_docx():
    log.info('download-docx: started')
    filename = request.args.get('filename')
    if filename == '':
        return CustomResponse(Status.ERR_GLOBAL_MISSING_PARAMETERS.value, 'filename missing').getres()
    try:

        n_filename = filename.split('_')
        try:
            log.info('download-docx: finding process from basename : ' + str(n_filename[0]))
            translationProcess = TranslationProcess.objects(basename=n_filename[0])
            if translationProcess is not None:
                data = translationProcess[0]['name']
                log.info('download-docx: process found for basename with name = ' + str(data))
                result = flask.send_file(os.path.join('upload/', filename), as_attachment=True,
                                         attachment_filename=data)
                result.headers["x-suggested-filename"] = data
        except Exception as e:
            log.info('download-docx: error in finding process for basename : ' + str(n_filename))
            result = flask.send_file(os.path.join('upload/', filename), as_attachment=True, attachment_filename="happy")
            result.headers["x-suggested-filename"] = filename
        return result
    except Exception as e:
        return CustomResponse(Status.DATA_NOT_FOUND.value, 'file not found').getres()


@document_api.route('/save-translated-docx', methods=['POST'])
def saveTranslateDocx():
    start_time = int(round(time.time() * 1000))
    log.info('uploadTranslateDocx: started at ' + str(start_time))
    if (request.form.getlist('basename') is None or not isinstance(request.form.getlist('basename'), list)):
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    basename = request.form.getlist('basename')[0]
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '_u.docx')
    index = 0
    while (os.path.exists(filepath)):
        filepath = os.path.join(
            app.config['UPLOAD_FOLDER'], basename + '_' + str(index) + '_u.docx')
        index = index + 1
    f.save(filepath)
    res = CustomResponse(Status.SUCCESS.value, basename + '_' + str(index) + '_u' + '.docx')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__translate_uploaded=True)

    log.info('uploadTranslateDocx: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
        getcurrenttime() - start_time))
    return res.getres()


@document_api.route('/translate-docx', methods=['POST'])
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
    log.info('model meta data' + model_meta_data)
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
    docx_helper.add_identification_tag(xmltree, basename)
    docx_helper.warp_original_with_identification_tags(filepath, xmltree, filepath_processed_src_with_ids)
    docx_helper.pre_process_text(xmltree)

    for node, text in docx_helper.itertext(xmltree):
        nodes.append(node)
        texts.append(text)

    log.info('translateDocx: number of nodes ' + str(len(nodes)) + ' and text are : ' + str(len(texts)))
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__eta=(TEXT_PROCESSING_TIME) * (len(texts) + get_pending_nodes()) / 25)
    """  method which don't use tokenization  """
    # docx_helper.modify_text(nodes)

    nodes_first_page = []
    # nodes_first_page = modify_first_page.get_first_page_nodes(nodes)
    # first_page_node_len = modify_first_page.get_size(nodes_first_page)
    # node_after_first_page = modify_first_page.get_nodes_after_f_page(nodes, first_page_node_len)
    #
    # modify_first_page.modify_text_on_first_page_using_model(nodes_first_page, model_id, url_end_point)
    docx_helper.modify_text_with_tokenization(nodes, None, model_id, url_end_point)
    # xml_footer_list = translate_footer.translate_footer(filepath, model_id, url_end_point)

    docx_helper.save_docx(filepath, xmltree, filepath_processed, None)

    res = CustomResponse(Status.SUCCESS.value, basename + '_t' + '.docx')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)

    log.info('translateDocx: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
        getcurrenttime() - start_time))
    return res.getres()

@document_api.route('/get-sentence-word-count', methods=['GET'])
def get_sentence_word_count():
    start_time = int(round(time.time() * 1000))
    log.info('get_sentence_word_count: started at ' + str(start_time))
    basename = request.args.get('basename')
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.docx')
    xmltree = None
    try:
        xml_content = docx_helper.get_document_xml(filepath)
        xmltree = docx_helper.get_xml_tree(xml_content)
    except Exception as e:
        log.info('get_sentence_word_count : Error while extracting docx, trying to convert it to docx from doc')
        try:
            log.info('here === 1  ==  '+ filepath)
            docx_helper.convert_DOC_to_DOCX(filepath)
            log.info('here === 2  ==  '+ filepath)
            xml_content = docx_helper.get_document_xml(filepath)
            log.info('here === 3  ==  '+ str(xml_content))

            xmltree = docx_helper.get_xml_tree(xml_content)
            log.info('get_sentence_word_count : doc to docx conversion successful')
        except Exception as e:
            log.error('get_sentence_word_count : Error while extracting docx files. error is = ' + str(e))
            log.error('get_sentence_word_count : Error while extracting docx files. uploaded file is corrupt')
            res = CustomResponse(Status.FAILURE.value, ' uploaded file is corrupt')
            log.info('get_sentence_word_count: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
                getcurrenttime() - start_time))
            return res.getres()
    nodes = []
    texts = []
    if xmltree is None:
        res = CustomResponse(Status.FAILURE.value, ' uploaded file is corrupt')
        log.info('translate_docx_v2: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
            getcurrenttime() - start_time))
        return res.getres()

    try:
        docx_helper.add_identification_tag(xmltree, basename)
        docx_helper.pre_process_text(xmltree)
    except Exception as e:
        log.error('translate_docx_v2 : error occureed for pre-processing document. Error is ' + str(e))
        log.info('translate_docx_v2 : not pre-processing document')
    word_count = 0
    for node, text in docx_helper.itertext_old(xmltree):
        nodes.append(node)
        texts.append(text)
        word_count = word_count + len(text.split(' '))
    res = CustomResponse(Status.SUCCESS.value, {'sentence_count':len(texts), 'word_count': word_count})
    return res.getres()


@document_api.route('/v2/translate-docx', methods=['POST'])
def translate_docx_v2():
    start_time = int(round(time.time() * 1000))
    log.info('translate_docx_v2: started at ' + str(start_time))
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    iso_date = datetime.now().isoformat()
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.docx')

    sourceLang = request.form.getlist('sourceLang')[0]
    targetLang = request.form.getlist('targetLang')[0]
    model_meta_data = request.form.getlist('model')[0]
    log.info('model meta data' + model_meta_data)
    model_obj = json.loads(model_meta_data)
    model_id = int(model_obj['model_id'])
    url_end_point = 'translation_en'
    if 'url_end_point' in model_obj:
        url_end_point = model_obj['url_end_point']
        targetLang = model_obj['target_language_code']
        sourceLang = model_obj['source_language_code']
    log.info('translate_docx_v2: started at ' + str(start_time))

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

    log.info("translate_docx_v2 : file name " + filename_to_processed)

    xmltree = None
    try:
        xml_content = docx_helper.get_document_xml(filepath)
        xmltree = docx_helper.get_xml_tree(xml_content)
    except Exception as e:
        log.info('translate_docx_v2 : Error while extracting docx, trying to convert it to docx from doc')
        try:
            docx_helper.convert_DOC_to_DOCX(filepath)
            xml_content = docx_helper.get_document_xml(filepath)
            xmltree = docx_helper.get_xml_tree(xml_content)
            log.info('translate_docx_v2 : doc to docx conversion successful')
        except Exception as e:
            log.error('translate_docx_v2 : Error while extracting docx files. error is = ' + str(e))
            log.error('translate_docx_v2 : Error while extracting docx files. uploaded file is corrupt')
            translationProcess = TranslationProcess.objects(basename=basename)
            translationProcess.update(set__status=STATUS_FAILED)
            res = CustomResponse(Status.CORRUPT_FILE.value, 'uploaded file is corrupt')
            log.info('translate_docx_v2: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
                getcurrenttime() - start_time))
            return res.getres(),500

    nodes = []
    texts = []
    if xmltree is None:
        res = CustomResponse(Status.CORRUPT_FILE.value, 'uploaded file is corrupt')
        log.info('translate_docx_v2: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
            getcurrenttime() - start_time))
        return res.getres(),500

    try:
        docx_helper.add_identification_tag(xmltree, basename)
        docx_helper.pre_process_text(xmltree)
    except Exception as e:
        log.error('translate_docx_v2 : error occureed for pre-processing document. Error is ' + str(e))
        log.info('translate_docx_v2 : not pre-processing document')
    docx_helper.warp_original_with_identification_tags(filepath, xmltree, filepath_processed_src_with_ids)
    
    word_count = 0
    for node, text in docx_helper.itertext_old(xmltree):
        nodes.append(node)
        texts.append(text)
        if text is not None:
            word_count = word_count + len(text.split(' '))

    doc_report = {}
    doc_report['word_count'] = word_count
    doc_report['sentence_count'] = len(texts)
    doc_report['source_lang'] = sourceLang
    doc_report['target_lang'] = targetLang
    doc_report['user_id'] = request.headers.get('ad-userid')
    userhighcourt_obj = Userhighcourt.objects(user_id=request.headers.get('ad-userid'))
    if userhighcourt_obj and len(userhighcourt_obj) > 0:
        userhighcourt_dict = json.loads(userhighcourt_obj.to_json())
        if 'high_court_code' in userhighcourt_dict[0]:
            high_court_obj = Highcourt.objects(high_court_code=userhighcourt_dict[0]['high_court_code'])
            if high_court_obj and len(high_court_obj) > 0 :
                highcourt_dict = json.loads(high_court_obj.to_json())
                if 'high_court_name' in highcourt_dict[0]:
                    doc_report['high_court_name'] = highcourt_dict[0]['high_court_name']
            doc_report['high_court_code'] = userhighcourt_dict[0]['high_court_code']
    try:
        profile = requests.get(PROFILE_REQ_URL + request.headers.get('ad-userid')).content
        profile = json.loads(profile)
        doc_report['username'] = profile['username']
    except Exception as e:
        log.error('translate_docx_v2 : error occurred for profile fetching, error is = ' + str(e))
    doc_report['document_id'] = basename
    doc_report['created_on'] = current_time
    doc_report['created_on_iso'] = iso_date
    log.info('sending data to elasticsearch =='+str(doc_report))
    try:
        create_dashboard_report(doc_report, 'doc_report')
    except Exception as e:
        log.error('translate_docx_v2 : error occurred for report saving, error is = ' + str(e))

    log.info('translate_docx_v2 : number of nodes = ' + str(len(nodes)) + ' and text are : ' + str(len(texts)))
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__eta=(TEXT_PROCESSING_TIME) * (len(texts) + get_pending_nodes()) / 25)
    total_nodes = get_total_number_of_nodes_with_text(nodes)
    try:
        doc_nodes = DocumentNodes(basename=basename, created_date=current_time, total_nodes=total_nodes, nodes_sent=0,
                                  nodes_received=0, is_complete=False)
        doc_nodes.save()
        send_nodes(nodes, basename, model_id, url_end_point, targetLang, sourceLang)
        res = CustomResponse(Status.SUCCESS.value, 'file has been queued')
        translationProcess = TranslationProcess.objects(basename=basename)
        translationProcess.update(set__status=STATUS_PROCESSING)
        log.info('translate_docx_v2: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
            getcurrenttime() - start_time))
        return res.getres()
    except Exception as e:
        log.error('translate_docx_v2 : error occurred file not processing, Error is = ' + str(e))
        translationProcess = TranslationProcess.objects(basename=basename)
        translationProcess.update(set__status=STATUS_FAILED)
        res = CustomResponse(Status.FAILURE.value, 'something went wrong')
        log.info('translate_docx_v2: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
            getcurrenttime() - start_time))
        return res.getres(),500


def get_pending_nodes():
    no_of_nodes = 0
    node_received = 0
    try:
        translationProcess = TranslationProcess.objects(status=STATUS_PROCESSING)
        for tp in translationProcess:
            doc_nodes = DocumentNodes.objects(basename=tp['basename'])
            try:
                no_of_nodes = no_of_nodes + doc_nodes[0]['nodes_sent']
                node_received = node_received + doc_nodes[0]['nodes_received']
            except Exception as e:
                log.info('get_pending_nodes : Exception occured while counting nodes for basename = ' + tp[
                    'basename'] + ' with error ' + str(e))
                pass
        log.info(
            'get_pending_nodes : nodes details == total_nodes : ' + str(no_of_nodes) + ', node_completed : ' + str(
                node_received))
        return no_of_nodes - node_received

    except Exception as e:
        log.info('get_pending_nodes : Exception occured : error is = ' + str(e))
        return 0


def getcurrenttime():
    return int(round(time.time() * 1000))


def get_model_code(model):
    if model is None:
        return 1


def get_lang(model):
    if model is None:
        return 'hi'


def send_nodes(nodes, basename, model_id, url_end_point, targetLang, sourceLang):
    log.info('send_nodes : started')
    if producer is None:
        raise Exception('Kafka Producer not available, aborting process')
    node_sent_count = get_total_number_of_nodes_with_text(nodes)
    if url_end_point == 'translate-anuvaad' and targetLang == 'en':
        node_sent_count = get_total_count_excluding_english(nodes)

    doc_nodes = DocumentNodes.objects(basename=basename)
    doc_nodes_dict = json.loads(doc_nodes.to_json())
    node_count = doc_nodes_dict[0]['nodes_sent']
    doc_nodes.update(nodes_sent=node_count + node_sent_count)

    for node in nodes:
        messages = []
        text = node.text
        if text is not None and text.strip() is not '':

            if url_end_point == 'translate-anuvaad' and targetLang == 'en' and isEnglish(text):

                log.info('send_nodes : Not sending particular node, because it already contains english, '
                         + ' Text in node is == ' + str(text))
            else:
                n_id = node.attrib['id']
                _id = model_id
                tokens = tokenize(node.text, sourceLang)
                token_len = len(tokens)
                created_date = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
                log.info('send_nodes : text in a node == ' + node.text)
                if not token_len == 0:
                    text_node = TextNode(node_id=n_id, sentences=messages, created_date=created_date,
                                         tokens_sent=token_len, is_complete=False, tokens_received=0, basename=basename)
                    text_node.save()
                    i = 0
                    for token in tokens:
                        if i == 25:
                            log.info('send_nodes : in 25 final msg is == ' + str(msg))
                            msg_ = {'url_end_point': url_end_point, 'message': messages}
                            producer.send(TOPIC, value=msg_)
                            producer.flush()
                            messages = []
                            i = 0
                        msg = {'src': token.strip(), 'id': _id, 'n_id': n_id, 's_id': i}
                        log.info('send_nodes : message is = ' + str(msg))
                        messages.append(msg)
                        i = i + 1
                    msg = {'url_end_point': url_end_point, 'message': messages}
                    log.info('send_nodes : final msg is == '+str(msg))
                    producer.send(TOPIC, value=msg)
                    producer.flush()
                    log.info('send_nodes : flushed')


def tokenize(text, lang):
    if lang == 'en':
        return sent_tokenize(text)
    else:
        return sentence_tokenize.sentence_split(text, lang=lang)


def get_total_number_of_nodes_with_text(nodes):
    count = 0
    if nodes is not None:
        for node in nodes:
            text = node.text
            if text is not None and text.strip() is not '':
                count = count + 1
        return count
    else:
        return 0


def get_total_count_excluding_english(nodes):
    count = 0
    if nodes is not None:
        for node in nodes:
            text = node.text
            if text is not None and text.strip() is not '':
                if not isEnglish(text):
                    count = count + 1
        return count
    else:
        return 0


def isEnglish(text):
    text = replace_special(text)
    try:
        text.encode(encoding='utf-8').decode('ascii')
    except UnicodeDecodeError:
        return False
    else:
        return True


def replace_special(text):
    text = text.replace('—', '-')
    return text
