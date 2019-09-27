"""
 * @author ['iostream04']
"""

from flask import Blueprint, request, current_app as app
import flask
import time
import os
import logging
from models.status import Status
from models.response import CustomResponse
import utils.docx_translate_helper as docx_helper
from models.translation_process import TranslationProcess
import utils.modify_first_page as modify_first_page
import utils.translate_footnote as translate_footer
from kafka_utils.producer import get_producer
from nltk.tokenize import sent_tokenize
from models.text_nodes import TextNode
from models.Document_nodes import DocumentNodes
import json
import uuid
from datetime import datetime
log = logging.getLogger('file')

document_api = Blueprint('document_api', __name__)
UPLOAD_FOLDER = 'upload'
STATUS_PENDING = 'PENDING'
STATUS_PROCESSING = 'PROCESSING'
STATUS_PROCESSED = 'COMPLETED'
producer = get_producer()
TOPIC = "to-nmt"


@document_api.route('/download-docx', methods=['GET'])
def download_docx():
    filename = request.args.get('filename')
    result = flask.send_file(os.path.join('upload/', filename), as_attachment=True)
    result.headers["x-suggested-filename"] = filename
    return result


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
    # model_meta_data = request.form.getlist('model')[0]
    # log.info('model meta data' + model_meta_data)
    # model_obj = json.loads(model_meta_data)
    url_end_point = 'translation_en'
    # model_id = int(model_obj['model_id'])
    # if 'url_end_point' in model_obj:
    #     url_end_point = model_obj['url_end_point']
    model_id = '1'
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


@document_api.route('/v2/translate-docx', methods=['POST'])
def translate_docx_v2():
    start_time = int(round(time.time() * 1000))
    log.info('translate_docx_v2: started at ' + str(start_time))
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")

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

    log.info("translate_docx_v2 : file name" + filename_to_processed)

    xml_content = docx_helper.get_document_xml(filepath)
    xmltree = docx_helper.get_xml_tree(xml_content)

    nodes = []
    texts = []
    docx_helper.add_identification_tag(xmltree, basename)
    docx_helper.pre_process_text(xmltree)
    docx_helper.warp_original_with_identification_tags(filepath, xmltree, filepath_processed_src_with_ids)

    for node, text in docx_helper.itertext_old(xmltree):
        nodes.append(node)
        texts.append(text)

    log.info('translate_docx_v2 : number of nodes = ' + str(len(nodes)) + ' and text are : ' + str(len(texts)))

    total_nodes = get_total_number_of_nodes_with_text(nodes)
    doc_nodes = DocumentNodes(basename=basename, created_date=current_time, total_nodes=total_nodes, nodes_sent=0,
                              nodes_received=0, is_complete=False)
    doc_nodes.save()
    send_nodes(nodes, basename, model_id, url_end_point)
    res = CustomResponse(Status.SUCCESS.value, 'file has been queued')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSING)

    log.info('translate_docx_v2: ended at ' + str(getcurrenttime()) + 'total time elapsed : ' + str(
        getcurrenttime() - start_time))
    return res.getres()


def getcurrenttime():
    return int(round(time.time() * 1000))


def get_model_code(model):
    if model is None:
        return 1


def get_lang(model):
    if model is None:
        return 'hi'


def send_nodes(nodes, basename, model_id, url_end_point):
    log.info('send_nodes : started')
    if producer is None:
        raise Exception('Kafka Producer not available, aborting process')
    node_sent_count = get_total_number_of_nodes_with_text(nodes)
    doc_nodes = DocumentNodes.objects(basename=basename)
    doc_nodes_dict = json.loads(doc_nodes.to_json())
    node_count = doc_nodes_dict[0]['nodes_sent']
    doc_nodes.update(nodes_sent=node_count + node_sent_count)

    for node in nodes:
        messages = []
        text = node.text
        if text is not None and text.strip() is not '':
            n_id = node.attrib['id']
            _id = model_id
            tokens = sent_tokenize(node.text)
            token_len = len(tokens)
            created_date = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            log.info('send_nodes : text in a node == '+node.text)
            if not token_len == 0:
                text_node = TextNode(node_id=n_id, sentences=messages, created_date=created_date,
                                     tokens_sent=token_len, is_complete=False, tokens_received=0, basename=basename)
                text_node.save()
                i = 0
                for token in tokens:
                    if i == 25:
                        producer.send(TOPIC, value=json.dumps(messages))
                        producer.flush()
                        messages = []
                        i = 0
                    msg = {'text': token.strip(), 'id': _id, 'n_id': n_id, 's_id': i, 'url_end_point': url_end_point}
                    log.info('send_nodes : message is = ' + str(msg))
                    messages.append(msg)
                    i = i + 1
                producer.send(TOPIC, value=json.dumps(messages))
                producer.flush()


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
