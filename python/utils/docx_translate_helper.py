import zipfile
from lxml import etree
import uuid
import tempfile
import os
import shutil
import codecs
import requests
import re
from nltk.tokenize import sent_tokenize
import queue
from models.Text_Object import Text_Object
import logging
from google.cloud import translate
import subprocess

NMT_BASE_URL = os.environ.get('NMT_BASE_URL', 'http://localhost:3003/translator/')
max_calls = 25
log = logging.getLogger('file')
DOCX_CONVERTOR = "soffice --headless --convert-to docx "


def get_xml_tree(xml_string):
    return etree.fromstring(xml_string)


def get_file_info(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
            LOG.debug(file.printdir())
    else:
        LOG.debug('get_file_info: filename ' + str(filename) + ' is not a zip file')


def get_document_xml(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
            LOG.debug('get_document_xml: Extracting all files...')
            file.extractall()
            LOG.debug('Done!')
            xml_content = file.read('word/document.xml')
            return xml_content
    else:
        return None


def get_endnote_xml(filename):
    try:
        if zipfile.is_zipfile(filename):
            with zipfile.ZipFile(filename) as file:
                LOG.debug('get_endnote_xml: Extracting all files...')
                file.extractall()
                LOG.debug('Done!')
                xml_content = file.read('word/endnotes.xml')
                return xml_content
        else:
            return None
    except Exception as e:

        pass


def iter_para(xmltree):
    """Iterator to go through xml tree's text nodes"""
    for node in xmltree.iter(tag=etree.Element):
        if check_element_is(node, 'p'):
            yield (node)


def itertext(xmltree):
    """Iterator to go through xml tree's text nodes"""
    # previous_node = None
    for node in xmltree.iter(tag=etree.Element):

        # if check_element_is(node, 'bookmarkStart'):
        #     if previous_node is not None:
        #         previous_node.getparent().remove(previous_node)
        if check_element_is(node, 'r'):
            LOG.debug('node is')
            LOG.debug(etree.tostring(node, pretty_print=True))
            text_node_found = False
            start_node = None
            text = ''
            for n in node.iter():
                if check_element_is(n, 't'):
                    text_node_found = True
                    if n.text is not None:
                        text = text + ' ' + n.text
                    if start_node is None:
                        start_node = n
                    else:
                        n.text = ''
            if text_node_found is True:
                LOG.debug("text is " + text)
                start_node.text = text
                yield (start_node, text)
        # if check_element_is(node, 'p'):
        #     previous_node = node


def itertext_old(xmltree):
    """Iterator to go through xml tree's text nodes"""
    # previous_node = None
    for node in xmltree.iter(tag=etree.Element):

        if check_element_is(node, 't'):
            yield (node, node.text)


def itertext_1(xmltree):
    """Iterator to go through xml tree's text nodes"""
    for node in xmltree.iter(tag=etree.Element):

        if check_element_is(node, 't'):
            yield (node, node.text)

        if check_element_is(node, 'bookmarkStart') or check_element_is(node, 'bookmarkEnd'):
            node.getparent().remove(node)
        if check_element_is(node, 'r'):
            LOG.debug('node is')
            LOG.debug(etree.tostring(node, pretty_print=True))
            text_node_found = False
            start_node = None
            text = ''
            for node2 in node.iter():
                if check_element_is(node2, 't'):
                    text_node_found = True
                    text = text + ' ' + node2.text
                    if start_node is None:
                        start_node = node2
                    else:
                        node2.text = ''
            if text_node_found is True:
                LOG.debug("text is " + text)
                start_node.text = text
                yield (start_node, text)


def check_element_is(element, type_char):
    word_schema = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    return element.tag == '{%s}%s' % (word_schema, type_char)


def add_identification_tag(xmltree, identifier):
    """ adding translation id for each node """
    for node, text in itertext_old(xmltree):
        node.attrib['id'] = identifier + '-' + str(uuid.uuid4())


def check_difference(x, prev):
    if prev == None:
        LOG.debug("PREV IS NULL")
        return False
    else:
        if not prev.attrib['i'] == x.attrib['i']:
            return False
        if not prev.attrib['u'] == x.attrib['u']:
            return False
        if not prev.attrib['color'] == x.attrib['color']:
            return False
        if not prev.attrib['b'] == x.attrib['b']:
            return False
        LOG.debug(" SAME ")
    return True


def count_iterable(i):
    return sum(1 for e in i)


def pre_process_text(xmltree):
    num_nodes = 0
    for para in iter_para(xmltree):

        num_nodes = num_nodes + 1
        LOG.debug(" NEW PARA == " + str(num_nodes))

        elements = 0
        para_child_count = count_iterable(para.iterchildren())
        LOG.debug("Paragraph children == " + str(para_child_count))

        sentence = ''
        para_text = None
        prev_run_text = ''
        for r in para.iterchildren():
            elements = elements + 1

            if r.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r':
                children = 0
                is_same = False
                run_text = ''
                prev_node_c = None
                for x in ((r.iterchildren())):
                    children = children + 1

                    if x.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t':
                        LOG.debug('TAG is: text ' + str(children))
                        LOG.debug('TAG text is == '+str(x.text))
                        if x is not None:
                            run_text = run_text + ' ' + x.text
                            x.text = ''
                            prev_node_c = x

                LOG.debug('RUN LEVEL TEXT IS =='+str(run_text))
                if prev_node_c is not None:
                    prev_node_c.text = run_text
                    sentence = sentence + run_text
        para_text = ''
        prev_run = None

        for r in para.iterchildren():
            elements = elements + 1

            if r.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r':

                run_text = ''
                prev_node_c = None
                for x in ((r.iterchildren())):
                    if x.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t':

                        LOG.debug('TAG text is == ' + str(x.text))
                        if x is not None and x.text is not '':
                            para_text = para_text + ' ' + x.text
                            x.text = ''
                            prev_run = x

        LOG.debug('RUN LEVEL TEXT IS ==' + str(run_text))
        if prev_run is not None:
            prev_run.text = para_text
            sentence = sentence + para_text
            LOG.debug('sentence is == '+str(sentence))




def modify_text_with_tokenization(nodes, url, model_id, url_end_point):
    LOG.debug('model id' + str(model_id))
    LOG.debug('url_end_point' + url_end_point)
    _url = NMT_BASE_URL + url_end_point
    if not url == None:
        _url = url
    arr = []
    Q = queue.Queue()
    """ Adding all the nodes into an array"""
    node_id = 0
    for node in nodes:
        if not (node.text.strip == ''):
            tokens = sent_tokenize(node.text)
            if not tokens.__len__ == 0:

                for text_ in tokens:
                    LOG.debug('modify_text_with_tokenization : TEXT SENT ==  ' + text_)
                    N_T = Text_Object(text_, str(node_id))
                    Q.put(N_T)

            LOG.debug('****************** : ' + node.attrib['id'] + '   ==  ' + node.text)
        node.attrib['node_id'] = str(node_id)
        node_id = node_id + 1

    i = 0
    Q_response = queue.Queue()

    while not Q.qsize() == 0:

        N_T = Q.get()
        t_ = N_T.text
        s_id = N_T.node_id

        arr.append({'src': t_, 'id': model_id, 's_id': s_id, 'n_id': 0})

        i = i + 1
        del N_T

        if i == 25:
            try:
                res = requests.post(_url, json=arr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    LOG.debug('modify_text_with_tokenization: ')
                    LOG.debug(dictFromServer['response_body'])
                    for translation in dictFromServer['response_body']:
                        try:

                            res = Text_Object(translation['tgt'], str(translation['s_id']))
                            Q_response.put(res)

                        except:
                            log.error('modify_text_with_tokenization: ERROR OCCURED for ' + translation)

            except:
                log.error('modify_text_with_tokenization: ERROR WHILE MAKING TRANSLATION REQUEST')
                pass
            arr = []
            i = 0
    if i > 0:
        try:
            res = requests.post(_url, json=arr)
            dictFromServer = res.json()
            if dictFromServer['response_body'] is not None:
                LOG.debug('modify_text_with_tokenization: LAST: ')
                LOG.debug(dictFromServer['response_body'])
                for translation in dictFromServer['response_body']:
                    try:

                        res = Text_Object(translation['tgt'], str(translation['s_id']))
                        Q_response.put(res)

                    except:
                        log.error('modify_text_with_tokenization: ERROR OCCURED for ' + translation)


        except:
            log.error('modify_text_with_tokenization: ERROR WHILE MAKING TRANSLATION REQUEST')
            pass
        arr = []
        i = 0

    node_id_ = ''
    prev = None
    for node in nodes:
        node_id_ = node.attrib['node_id']
        LOG.debug(node_id_)
        text = ''
        while not Q_response.qsize() == 0:
            T_S = None
            if prev == None:
                T_S = Q_response.get()
            else:
                T_S = prev

            _id = T_S.node_id
            if _id == node_id_:
                text = text + T_S.text + ' '
                prev = None
            else:
                prev = T_S
                LOG.debug('modify_text_with_tokenization: node text before == ' + node.text)
                node.text = text
                LOG.debug('modify_text_with_tokenization: node text after = ' + node.text)
                break

        if Q_response.qsize() == 0 and text == '' and prev is not None:
            LOG.debug('modify_text_with_tokenization **: node text before == ' + node.text)
            node.text = prev.text
            LOG.debug('modify_text_with_tokenization **: node text after == ' + node.text)


def warp_original_with_identification_tags(input_docx_file_path, xml_tree, output_docx_filepath):
    LOG.debug('warp_original_with_identification_tags : started')
    none = []
    save_docx(input_docx_file_path, xml_tree, output_docx_filepath, none)


def save_docx(input_docx_filepath, xmltree, output_docx_filepath, xml_tree_footer_list=None):
    tmp_dir = tempfile.mkdtemp()
    LOG.debug('save_docx: Extracting ' + str(input_docx_filepath) + ' in temp directory ' + tmp_dir)
    if not zipfile.is_zipfile(input_docx_filepath):
        log.error('save_docx: ' + str(input_docx_filepath) + ' is not valid filepath')
        return None

    filenames = []
    with zipfile.ZipFile(input_docx_filepath) as file:
        file.extractall(tmp_dir)
        with open(os.path.join(tmp_dir, 'word/document.xml'), 'w') as f:
            xmlstr = etree.tostring(xmltree, encoding='unicode')
            f.write(xmlstr)
            f.close()
        try:
            if xml_tree_footer_list is not None:
                i = 1
                file_name_xml = 'footer'
                for footer in xml_tree_footer_list:
                    LOG.debug("save_docx: opening:" + file_name_xml + str(i) + '.xml')
                    with open(os.path.join(tmp_dir, 'word/' + file_name_xml + str(i) + '.xml'), 'w') as f1:
                        xmlstr = etree.tostring(footer, encoding='unicode')
                        f1.write(xmlstr)
                        i = i + 1
                        f1.close()
                        LOG.debug("save_docx: closing:" + file_name_xml + str(i) + '.xml')
        except Exception as e:
            log.error("save_docx: ERROR while writing footers == " + str(e))

            i = 1
            file_name_xml = 'footer'
            for footer in xml_tree_footer_list:
                LOG.debug("save_docx: opening:" + file_name_xml + str(i) + '.xml')
                with open(os.path.join(tmp_dir, 'word/' + file_name_xml + str(i) + '.xml'), 'w') as f1:
                    xmlstr = etree.tostring(footer, encoding='unicode')
                    f1.write(xmlstr)
                    i = i + 1
                    f1.close()
                    LOG.debug("save_docx: closing:" + file_name_xml + str(i) + '.xml')
        except:
            log.error("save_docx: ERROR while writing footers")

        filenames = file.namelist()

    with zipfile.ZipFile(output_docx_filepath, "w") as docx:
        for filename in filenames:
            docx.write(os.path.join(tmp_dir, filename), filename)

    LOG.debug('save_docx: saving modified document at ' + str(output_docx_filepath))


def modify_text__2(nodes):
    translate_client = translate.Client()
    arr = []
    results = []
    """ Adding all the nodes into an array"""

    """ Iterating Over nodes one by one and making Translate API call in a batch of 25 text """
    for node in nodes:
        arr.append(node.text)

        LOG.debug('modify_text: node text before translation:' + node.text)

        if (arr.__len__ == max_calls):
            try:
                # res = requests.post(translate_url, json=arr)
                translationarray = translate_client.translate(
                    arr,
                    target_language='hin')
                if translationarray is not None:
                    LOG.debug('modify_text: ')
                    LOG.debug(translationarray)
                    for translation in translationarray:
                        try:
                            # LOG.debug('modify_text: recieved translating from server: ')
                            # LOG.debug(translation)
                            results.append(translation['translatedText'])
                        except:
                            LOG.debug("modify_text: ERROR: while adding to the results list")
                            results.append({'text': None})

            except:
                log.error('modify_text: ERROR: while getting data from translating server ')
                pass
            arr = []
        arr_len = arr.__len__
    if not (arr.__len__ == 0):
        try:
            translationarray = translate_client.translate(
                arr,
                target_language='hin')
            if translationarray is not None:
                LOG.debug('modify_text: ')
                LOG.debug(translationarray)
                for translation in translationarray:
                    try:
                        # LOG.debug('modify_text: recieved translating from server: ')
                        # LOG.debug(translation)
                        results.append(translation['translatedText'])
                    except:
                        log.error("modify_text: ERROR: while adding to the results list")
                        results.append({'text': None})

        except:
            log.error('modify_text: ERROR: while getting data from translating server for less than 25 batch size ')
    i = 0
    LOG.debug('modify_text: following are the text and its translation')
    for node in nodes:
        LOG.debug(node.text + '\n')
        try:
            node.text = results[i]['tgt']
            LOG.debug(node.text + '\n')
        except Exception as e:
            LOG.debug('*****: ' + str(results[i]))
            pass
        i = i + 1


def convert_DOC_to_DOCX(filename):
    LOG.debug('convert_DOC_to_DOCX : filename is == '+filename)
    try:
        name = filename.split('/')
        command = DOCX_CONVERTOR + filename + ' --outdir upload'
        os.system(command)
    except Exception as e:
        LOG.debug('convert_DOC_to_DOCX : Error Occured == '+str(e))
        pass
    LOG.debug('convert_DOC_to_DOCX : completed')