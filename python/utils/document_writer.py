import os
from flask import Flask, current_app as app
from kafka_utils.consumer import get_consumer
import utils.docx_translate_helper as docx_helper
from models.text_nodes import TextNode
from models.translation_process import TranslationProcess
import json
import logging

log = logging.getLogger('file')
app = Flask(__name__)
TOPIC_TO_PROCESS = 'to-process'
STATUS_PROCESSED = 'COMPLETED'
app.config['UPLOAD_FOLDER'] = 'upload'

def write_document_basename(basename):
    log.info('write_document : started for ' + basename)
    with app.app_context():
        filepath = os.path.join(
                    app.config['UPLOAD_FOLDER'], basename + '_s.docx')
        filepath_processed = os.path.join(
                    app.config['UPLOAD_FOLDER'], basename + '_t' + '.docx')

        xml_content = docx_helper.get_document_xml(filepath)
        xmltree = docx_helper.get_xml_tree(xml_content)
        nodes = []

        for node, text in docx_helper.itertext_old(xmltree):
            nodes.append(node)
        for node in nodes:
            node_id = node.attrib['id']
            if node.text is not None and node.text.strip() is not '':
                text_node = TextNode.objects(node_id=node_id, basename=basename)
                if text_node is not None:
                    tgt_text = get_tgt_text(text_node)
                    node.text = tgt_text
        docx_helper.save_docx(filepath, xmltree, filepath_processed, None)
        translationProcess = TranslationProcess.objects(basename=basename)
        translationProcess.update(set__status=STATUS_PROCESSED)
        log.info('write_document : ended for ' + basename)


def write_document():
    consumer = get_consumer(TOPIC_TO_PROCESS)
    if consumer is None:
        raise Exception('Kafka consumer not available, aborting process')
    try:
        for msg in consumer:
            basename = str(msg.value)
            log.info('write_document : started for ' + basename)
            with app.app_context():
                filepath = os.path.join(
                    app.config['UPLOAD_FOLDER'], basename + '_s.docx')
                filepath_processed = os.path.join(
                    app.config['UPLOAD_FOLDER'], basename + '_t' + '.docx')

                xml_content = docx_helper.get_document_xml(filepath)
                xmltree = docx_helper.get_xml_tree(xml_content)
                nodes = []

                for node, text in docx_helper.itertext_old(xmltree):
                    nodes.append(node)
                for node in nodes:
                    node_id = node.attrib['id']
                    if node.text is not None and node.text.strip() is not '':
                        text_node = TextNode.objects(node_id=node_id, basename=basename)
                        if text_node is not None and not len(text_node) == 0:
                            tgt_text = get_tgt_text(text_node)
                            node.text = tgt_text
                docx_helper.save_docx(filepath, xmltree, filepath_processed, None)
                translationProcess = TranslationProcess.objects(basename=basename)
                translationProcess.update(set__status=STATUS_PROCESSED)
                log.info('write_document : ended for ' + basename)
    except Exception as e:
        log.error('write_document : ERROR OCCURRED : NMT SERVER ERROR '+str(e))
        write_document()


def get_tgt_text(text_node):
    text_node_dict = json.loads(text_node.to_json())
    log.info('get_tgt_text : text_node = ' + str(text_node_dict))
    sentences = text_node_dict[0]['sentences']
    sorted_sentences = sorted(sentences, key=lambda i: i['s_id'])
    log.info('get_tgt_text : sorted text = ' + str(sorted_sentences))
    tgt_text = ''
    s_id_processed = set()
    for sentence in sorted_sentences:
        if not s_id_processed.__contains__(sentence['s_id']):
            tgt_text = tgt_text + sentence['tgt'] + ' '
            s_id_processed.add(sentence['s_id'])

    log.info('get_tgt_text = ' + tgt_text)
    return tgt_text.strip()
