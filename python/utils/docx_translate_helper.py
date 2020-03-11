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

RUN = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r'
TEXT = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'
TAB = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tab'
RUN_PROP = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr'
R_FONTS = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rFonts'
FONTS_EAST_ASIA = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia'
FONTS_CS = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}cs'
FONT_ASCII = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii'
FONT_HANSI = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi'
EAST_ASIA = 'east_asia'
CS = 'cs'
ASCII = 'ascii'
HANSI = 'hansi'


def get_xml_tree(xml_string):
    return etree.fromstring(xml_string)


def get_file_info(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
            log.info(file.printdir())
    else:
        log.info('get_file_info: filename ' + str(filename) + ' is not a zip file')


def get_document_xml(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
            log.info('get_document_xml: Extracting all files...')
            file.extractall()
            log.info('Done!')
            xml_content = file.read('word/document.xml')
            return xml_content
    else:
        return None


def get_endnote_xml(filename):
    try:
        if zipfile.is_zipfile(filename):
            with zipfile.ZipFile(filename) as file:
                log.info('get_endnote_xml: Extracting all files...')
                file.extractall()
                log.info('Done!')
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
            log.info('node is')
            log.info(etree.tostring(node, pretty_print=True))
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
                log.info("text is " + text)
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
            log.info('node is')
            log.info(etree.tostring(node, pretty_print=True))
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
                log.info("text is " + text)
                start_node.text = text
                yield (start_node, text)


def check_element_is(element, type_char):
    word_schema = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    word_schema2 = 'http://purl.oclc.org/ooxml/wordprocessingml/main'
    return element.tag == '{%s}%s' % (word_schema, type_char) or element.tag == '{%s}%s' % (word_schema2, type_char)


def add_identification_tag(xmltree, identifier):
    """ adding translation id for each node """
    for node, text in itertext_old(xmltree):
        node.attrib['id'] = identifier + '-' + str(uuid.uuid4())


def check_difference(x, prev):
    if prev == None:
        log.debug("check_difference : PREV IS NULL")
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
        log.debug("check_difference : SAME ")
    return True


def count_iterable(i):
    return sum(1 for e in i)


def check_prop_difference(curr, prev):
    log.info('check_prop_difference : started')
    try:
        prop_ascii = curr.attrib[ASCII]
        prop_hansi = curr.attrib[HANSI]
        prop_cs = curr.attrib[CS]
        prop_east_asia = curr.attrib[EAST_ASIA]
        prev_prop_ascii = prev.attrib[ASCII]
        prev_prop_hansi = prev.attrib[HANSI]
        prev_prop_cs = prev.attrib[CS]
        prev_prop_east_asia = prev.attrib[EAST_ASIA]
        if not prop_ascii == 'None' and not prev_prop_ascii == 'None':
            if prop_ascii == prev_prop_ascii:
                return True
        if not prop_hansi == 'None' and not prev_prop_hansi == 'None':
            if prop_hansi == prev_prop_hansi:
                return True
        if not prop_cs == 'None' and not prev_prop_cs == 'None':
            if prop_cs == prev_prop_cs:
                return True
        if not prop_east_asia == 'None' and not prev_prop_east_asia == 'None':
            if prop_east_asia == prev_prop_east_asia:
                return True
        log.info('check_prop_difference : ended')
        return False
    except Exception as e:
        log.error('check_prop_difference : Error occurred, merging para as no props found, error is ' + str(e))
        return True


def pre_process_text(xmltree):
    log.info('pre_process_text: started ')
    pre_process_properties(xmltree)
    for para in iter_para(xmltree):

        para_child_count = count_iterable(para.iterchildren())
        log.debug('pre_process_text : Paragraph children == ' + str(para_child_count))

        sentence = ''
        for r in para.iterchildren():

            if r.tag == RUN:
                run_text = ''
                prev_node_c = None
                for x in r.iterchildren():
                    log.info(str(x.tag))
                    if x.tag == check_element_is(x, 't'):
                        log.info('TAG text is == ' + str(x.text))
                        if x is not None:
                            log.info('x is not None ')
                            run_text = run_text + x.text
                            x.text = ''
                            prev_node_c = x

                log.debug('pre_process_text : run level text is == ' + str(run_text))
                if prev_node_c is not None:
                    prev_node_c.text = run_text
                    sentence = sentence + run_text

        para_text = ''
        prev_run = None
        prev_run_ = None
        log.info('pre_process_text :  merging run')
        for r in para.iterchildren():

            if check_element_is(r, 'r'):

                run_text = ''
                for x in r.iterchildren():
                    if check_element_is(x, 't'):

                        log.debug('pre_process_text : TAG text is  == ' + str(x.text))
                        if x is not None and x.text is not '':
                            if prev_run is None:
                                log.debug('pre_process_text :TAG text is  == ' + str(x.text))
                                para_text = para_text + x.text
                                x.text = ''
                                prev_run = x
                                prev_run_ = prev_run
                            else:
                                similar = check_prop_difference(x, prev_run)
                                if similar:

                                    para_text = para_text + x.text
                                    x.text = ''
                                    prev_run = x
                                    prev_run_ = prev_run
                                else:

                                    prev_run.text = para_text
                                    prev_run = None
                                    para_text = ''
                                    para_text = para_text + x.text
                                    x.text = ''
                    if check_element_is(x, 'tab'):
                        para_text = para_text + ' '


                log.debug('pre_process_text: RUN LEVEL TEXT IS ==' + str(run_text))
        if prev_run_ is not None:
            prev_run_.text = para_text
            sentence = sentence + para_text
            log.info('pre_process_text: sentence is == ' + str(sentence))


def pre_process_properties(xmltree):
    log.info('pre_process_properties : started')
    for para in iter_para(xmltree):

        para_child_count = count_iterable(para.iterchildren())
        log.info('pre_process_properties : Paragraph children == ' + str(para_child_count))

        for r in para.iterchildren():
            if check_element_is(r, 'r'):
                rp = get_run_font_props(r)
                if rp is not None:
                    prop_ascii = get_attrib(rp, FONT_ASCII)
                    prop_hansi = get_attrib(rp, FONT_HANSI)
                    prop_cs = get_attrib(rp, FONTS_CS)
                    prop_east_asia = get_attrib(rp, FONTS_EAST_ASIA)
                    text_node = get_text_node(r)

                    if text_node is not None:

                        text_node.attrib[ASCII] = prop_ascii
                        text_node.attrib[HANSI] = prop_hansi
                        text_node.attrib[CS] = prop_cs
                        text_node.attrib[EAST_ASIA] = prop_east_asia


def get_attrib(data, key):
    try:
        for k in data.keys():
            if k == key:
                attrib = data.get(key)
        return attrib
    except Exception as e:
        log.error('get_attrib : No attrib present with key == ' + str(key))
        return 'None'


def get_text_node(node):
    for x in node.iterchildren():
        if x is not None and check_element_is(x, 't'):
            return x
    return None


def get_run_font_props(node):
    for x in node.iterchildren():
        if x is not None and check_element_is(x, 'rPr'):
            for rp in x.iterchildren():
                if check_element_is(rp, 'rFonts'):
                    return rp
    return None


def modify_text_with_tokenization(nodes, url, model_id, url_end_point):
    log.info('model id' + str(model_id))
    log.info('url_end_point' + url_end_point)
    _url = NMT_BASE_URL + url_end_point
    if url is not None:
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
                    log.info('modify_text_with_tokenization : TEXT SENT ==  ' + text_)
                    N_T = Text_Object(text_, str(node_id))
                    Q.put(N_T)

            log.info('****************** : ' + node.attrib['id'] + '   ==  ' + node.text)
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
                    log.info('modify_text_with_tokenization: ')
                    log.info(dictFromServer['response_body'])
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
                log.info('modify_text_with_tokenization: LAST: ')
                log.info(dictFromServer['response_body'])
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
        log.info(node_id_)
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
                log.info('modify_text_with_tokenization: node text before == ' + node.text)
                node.text = text
                log.info('modify_text_with_tokenization: node text after = ' + node.text)
                break

        if Q_response.qsize() == 0 and text == '' and prev is not None:
            log.info('modify_text_with_tokenization **: node text before == ' + node.text)
            node.text = prev.text
            log.info('modify_text_with_tokenization **: node text after == ' + node.text)


def warp_original_with_identification_tags(input_docx_file_path, xml_tree, output_docx_filepath):
    log.info('warp_original_with_identification_tags : started')
    none = []
    save_docx(input_docx_file_path, xml_tree, output_docx_filepath, none)


def save_docx(input_docx_filepath, xmltree, output_docx_filepath, xml_tree_footer_list=None):
    tmp_dir = tempfile.mkdtemp()
    log.info('save_docx: Extracting ' + str(input_docx_filepath) + ' in temp directory ' + tmp_dir)
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
                    log.info("save_docx: opening:" + file_name_xml + str(i) + '.xml')
                    with open(os.path.join(tmp_dir, 'word/' + file_name_xml + str(i) + '.xml'), 'w') as f1:
                        xmlstr = etree.tostring(footer, encoding='unicode')
                        f1.write(xmlstr)
                        i = i + 1
                        f1.close()
                        log.info("save_docx: closing:" + file_name_xml + str(i) + '.xml')
        except Exception as e:
            log.error("save_docx: ERROR while writing footers == " + str(e))

            i = 1
            file_name_xml = 'footer'
            for footer in xml_tree_footer_list:
                log.info("save_docx: opening:" + file_name_xml + str(i) + '.xml')
                with open(os.path.join(tmp_dir, 'word/' + file_name_xml + str(i) + '.xml'), 'w') as f1:
                    xmlstr = etree.tostring(footer, encoding='unicode')
                    f1.write(xmlstr)
                    i = i + 1
                    f1.close()
                    log.info("save_docx: closing:" + file_name_xml + str(i) + '.xml')
        except:
            log.error("save_docx: ERROR while writing footers")

        filenames = file.namelist()

    with zipfile.ZipFile(output_docx_filepath, "w") as docx:
        for filename in filenames:
            docx.write(os.path.join(tmp_dir, filename), filename)

    log.info('save_docx: saving modified document at ' + str(output_docx_filepath))


def modify_text__2(nodes):
    translate_client = translate.Client()
    arr = []
    results = []
    """ Adding all the nodes into an array"""

    """ Iterating Over nodes one by one and making Translate API call in a batch of 25 text """
    for node in nodes:
        arr.append(node.text)

        log.info('modify_text: node text before translation:' + node.text)

        if (arr.__len__ == max_calls):
            try:
                # res = requests.post(translate_url, json=arr)
                translationarray = translate_client.translate(
                    arr,
                    target_language='hin')
                if translationarray is not None:
                    log.info('modify_text: ')
                    log.info(translationarray)
                    for translation in translationarray:
                        try:
                            # log.info('modify_text: recieved translating from server: ')
                            # log.info(translation)
                            results.append(translation['translatedText'])
                        except:
                            log.info("modify_text: ERROR: while adding to the results list")
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
                log.info('modify_text: ')
                log.info(translationarray)
                for translation in translationarray:
                    try:
                        # log.info('modify_text: recieved translating from server: ')
                        # log.info(translation)
                        results.append(translation['translatedText'])
                    except:
                        log.error("modify_text: ERROR: while adding to the results list")
                        results.append({'text': None})

        except:
            log.error('modify_text: ERROR: while getting data from translating server for less than 25 batch size ')
    i = 0
    log.info('modify_text: following are the text and its translation')
    for node in nodes:
        log.info(node.text + '\n')
        try:
            node.text = results[i]['tgt']
            log.info(node.text + '\n')
        except Exception as e:
            log.info('*****: ' + str(results[i]))
            pass
        i = i + 1


def convert_DOC_to_DOCX(filename):
    log.info('convert_DOC_to_DOCX : filename is == ' + filename)
    try:
        name = filename.split('/')
        command = DOCX_CONVERTOR + filename + ' --outdir upload'
        os.system(command)
    except Exception as e:
        log.info('convert_DOC_to_DOCX : Error Occured == ' + str(e))
        pass
    log.info('convert_DOC_to_DOCX : completed')


def get_name_space(space_name):
    base = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    return base + space_name
