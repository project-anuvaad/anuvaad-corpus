import zipfile
from lxml import etree
import uuid 
import tempfile
import os
import shutil
import codecs
import requests
from nltk.tokenize import sent_tokenize
import queue
from models.Text_Object import Text_Object
import logging

translate_url = 'http://18.236.30.130:3003/translator/translation_en'
max_calls = 25
log = logging.getLogger('file')

def get_xml_tree(xml_string):
    return etree.fromstring(xml_string)

def get_file_info(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
                log.info(file.printdir())
    else:
        log.info('get_file_info: filename ' +str(filename) + ' is not a zip file')
        
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
    except expression as identifier:
        pass
    
def iter_para(xmltree):
    """Iterator to go through xml tree's text nodes"""
    for node in xmltree.iter(tag=etree.Element):
        if check_element_is(node, 'p'):
            yield (node)   

def itertext(xmltree):
    """Iterator to go through xml tree's text nodes"""
    for node in xmltree.iter(tag=etree.Element):
        if check_element_is(node, 'r'):
            log.info('node is')
            log.info(etree.tostring(node, pretty_print=True))
            text_node_found = False
            start_node = None
            text = ''
            for node2 in node.iter():
                if check_element_is(node2, 't'):
                    text_node_found = True
                    text = text + ' '+node2.text
                    if start_node is None:
                        start_node = node2
                    else:
                        node2.text = ''
            if text_node_found is True:
                log.info("text is "+text)
                start_node.text = text
                yield (start_node, text)
def itertext_1(xmltree):
    """Iterator to go through xml tree's text nodes"""
    for node in xmltree.iter(tag=etree.Element):
        if check_element_is(node, 'r'):
            log.info('node is')
            log.info(etree.tostring(node, pretty_print=True))
            text_node_found = False
            start_node = None
            text = ''
            for node2 in node.iter():
                if check_element_is(node2, 't'):
                    text_node_found = True
                    text = text + ' '+node2.text
                    if start_node is None:
                        start_node = node2
                    else:
                        node2.text = ''
            if text_node_found is True:
                log.info("text is "+text)
                start_node.text = text
                yield (start_node, text)         

def check_element_is(element, type_char):
    word_schema = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    return element.tag == '{%s}%s' % (word_schema, type_char)

def add_identification_tag(xmltree, identifier):
    """ adding translation id for each node """
    for node, text in itertext(xmltree):
        node.attrib['id'] = identifier
    
      
def modify_text(nodes):
    
    arr = []
    results = []
    """ Adding all the nodes into an array"""
    
    """ Iterating Over nodes one by one and making Translate API call in a batch of 25 text """
    for node in nodes:
        if not node.text.strip() == '':
            arr.append({'src': node.text.lower().strip(), 'id': 1})
        else:
            arr.append({'src': node.text, 'id': 1})

        log.info('modify_text: node text before translation:' +node.text)

        if(arr.__len__ == max_calls):
            try:    
                res = requests.post(translate_url, json=arr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    log.info('modify_text: ') 
                    log.info( dictFromServer['response_body'])
                    for translation in dictFromServer['response_body']:
                        try: 
                            # log.info('modify_text: recieved translating from server: ') 
                            # log.info(translation)
                            results.append(translation)
                        except:
                            log.info("modify_text: ERROR: while adding to the results list")
                            results.append({'text':None})    
                
            except: 
                log.error('modify_text: ERROR: while getting data from translating server ')
                pass   
            arr = []
        arr_len = arr.__len__
    if not (arr.__len__ ==  0):
            try:    
                res = requests.post(translate_url, json=arr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    log.info('modify_text: ') 
                    log.info( dictFromServer['response_body'])
                    for translation in dictFromServer['response_body']:
                        try: 
                            # log.info('modify_text: recieved translating from server: ') 
                            # log.info(translation)
                            results.append(translation)
                        except:
                            log.error("modify_text: ERROR: while adding to the results list")
                            results.append({'text':None})    
                
            except: 
                log.error('modify_text: ERROR: while getting data from translating server for less than 25 batch size ')
    i = 0 
    log.info('modify_text: following are the text and its translation')          
    for node in nodes:
        log.info(node.text + '\n')
        node.text = results[i]['tgt']
        log.info(node.text + '\n')
        i = i + 1

def check_difference(x, prev):
    if prev == None:
        log.info("PREV IS NULL")
        return False
    else:
        if not  prev.attrib['i'] == x.attrib['i']:
            return False
        if not  prev.attrib['u'] == x.attrib['u']:
            return False
        if not  prev.attrib['color'] == x.attrib['color']:
            return False
        if not prev.attrib['b'] == x.attrib['b']:
            return False
        log.info(" SAME ")    
    return True 

def count_iterable(i):
    return sum(1 for e in i)  

def pre_process_text(xmltree):
    num_nodes =0
    for para in iter_para(xmltree):
        prev_text_node = None
        num_nodes = num_nodes+1
        arr = []
        log.info(" NEW PARA == "+ str( num_nodes))
        
        elements = 0
       
        prev_prop_node = None
        para_child_count = count_iterable( para.iterchildren())
        log.info("Paragraph children == "+ str(para_child_count))
        contains_text = False
        sentence = ''
        for r in para.iterchildren():
            elements = elements + 1
            if r.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r':
                children = 0
                is_same = False
                
                for x in ((r.iterchildren())):
                    children = children + 1
                    if x.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr':
                        log.info('TAG is: rPr '+str(children))
                        x.attrib['i'] = "None"
                        x.attrib['u'] = "None"
                        x.attrib['color'] = "None"
                        x.attrib['b'] = "None"
                       
                        for cv in x.iter():
                            if cv.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}i':
                                try:

                                    log.debug(cv.values())
                                    x.attrib['i'] = cv.values()[0]
                                    log.debug(x.attrib['i'])
                                except:
                                    x.attrib['i'] = "None"
                                continue
                            elif cv.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}color':
                                try:
                                    log.debug(cv.values())
                                    x.attrib['color'] = cv.values()[0]
                                    log.debug(x.attrib['color'])
                                except:
                                    x.attrib['color'] = "None"
                                continue
                            elif cv.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}u':
                                try:
                                    log.debug(cv.values())
                                    x.attrib['u'] = cv.values()[0]
                                    log.debug(x.attrib['u'])
                                except:
                                    x.attrib['u'] = "None"
                                    continue
                            elif cv.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}b':
                                log.info(cv.values())

                                try:
                                    if cv.values() == None and not cv.values().__len__ == 0:
                                        x.attrib['b'] = cv.values()[0]
                                except:
                                        x.attrib['b'] = "None"
                                log.debug(x.attrib['b'])
                                continue
                            
                        is_same = check_difference(x , prev_prop_node )
                        prev_prop_node = x


                    elif x.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t':
                        log.debug('TAG is: text '+ str(children))
                        
                        if not (is_same):
                            log.info (' TEXT TILL NOW ==== ' +sentence)
                            if not prev_text_node  == None:

                                log.debug("FOR PREV === "+sentence)
                                
                                prev_text_node.text =  sentence
                                sentence = ''
                                

                        
                        log.debug('SENTENCE IS === '+sentence)
                        if not x.text == None and  x.text.strip() == '':
                            prev_text_node = None
                            prev_prop_node = None
                            log.debug("x.text is null")
                        else:
                            log.debug("x.text is not null, text is == " + x.text)
                            sentence = sentence + x.text
                            prev_text_node = x
                            
                            x.text = ''
                        
                        if para_child_count == elements:
                            x.text = sentence
                            sentence = ''
                            prev_text_node = None
                            log.info("final text === " + x.text)
                    elif x.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tab':
                        if not prev_text_node == None:
                            prev_text_node.text = sentence
                        sentence = ''
                        prev_text_node = None
                        prev_prop_node = None  
                    


def modify_text_with_tokenization(nodes, url, model_id, url_end_point):
    log.info('model id'+str(model_id))
    log.info('url_end_point'+url_end_point)
    _url = 'http://18.236.30.130:3003/translator/'+url_end_point
    if not  url == None:
        _url = url 
    
    arr = []
    Q = queue.Queue()
    """ Adding all the nodes into an array"""
    node_id = 0
    for node in nodes:
        if not (node.text.strip==''):
            tokens = sent_tokenize(node.text)
            if not tokens.__len__ == 0:

                for text_ in tokens:
                    if text_.isupper():
                        text_ = text_.lower()
                    log.info('modify_text_with_tokenization : TEXT SENT ==  '+text_)
                    N_T = Text_Object(text_ , str(node_id))
                    Q.put(N_T)

        node.attrib['node_id'] = str(node_id)
        node_id = node_id + 1

    i =0
    Q_response = queue.Queue()

    while not Q.qsize() == 0:

        N_T = Q.get()
        t_= N_T.text
        s_id = N_T.node_id
        
        arr.append({'src': t_, 'id': model_id,'s_id':s_id})
        
        i = i +1
        del N_T

        if i == 25:
            try:
                res = requests.post(_url, json=arr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    log.info('modify_text_with_tokenization: ') 
                    log.info( dictFromServer['response_body'])
                    for translation in dictFromServer['response_body']:
                        try:    
                            
                            res = Text_Object(translation['tgt'],str(translation['s_id']))
                            Q_response.put(res)
                           
                        except:
                            log.error('modify_text_with_tokenization: ERROR OCCURED for '+ translation)    
                        
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
                    log.info( dictFromServer['response_body'])
                    for translation in dictFromServer['response_body']:
                        try: 
                            
                            res = Text_Object(translation['tgt'],str(translation['s_id']))
                            Q_response.put(res)
                           
                        except:
                           log.error('modify_text_with_tokenization: ERROR OCCURED for '+ translation)   
                        
                
        except: 
                log.error('modify_text_with_tokenization: ERROR WHILE MAKING TRANSLATION REQUEST')
                pass   
        arr = []
        i = 0 
            
    node_id_ = ''
    prev = None
    for node in nodes:
        node_id_ =  node.attrib['node_id']
        log.info(node_id_)
        text =''
        while not Q_response.qsize() == 0:
            T_S = None
            if prev == None: 
                T_S = Q_response.get()
            else:
                T_S = prev
            
            _id = T_S.node_id
            if _id == node_id_:
                text = text + T_S.text+' '
                prev = None
            else:
                prev = T_S
                log.info('modify_text_with_tokenization: node text before == '+ node.text)
                node.text = text 
                log.info('modify_text_with_tokenization: node text after = ' +node.text)
                break
        if  Q_response.qsize() == 0 and not  text == '':
            node.text =  text

def warp_original_with_identification_tags(input_docx_file_path, xml_tree, output_docx_filepath):
    log.info('warp_original_with_identification_tags : started')
    none =[]
    save_docx(input_docx_file_path, xml_tree, output_docx_filepath, none)



def save_docx(input_docx_filepath, xmltree, output_docx_filepath, xml_tree_footer_list):
    tmp_dir = tempfile.mkdtemp()
    log.info('save_docx: Extracting '+ str(input_docx_filepath) +' in temp directory ' +tmp_dir)
    if not zipfile.is_zipfile(input_docx_filepath):
        log.error('save_docx: '+str(input_docx_filepath) +' is not valid filepath')
        return None

    filenames = []
    with zipfile.ZipFile(input_docx_filepath) as file:
        file.extractall(tmp_dir)
        with open(os.path.join(tmp_dir,'word/document.xml'), 'w') as f:
            xmlstr = etree.tostring(xmltree, encoding='unicode')
            f.write(xmlstr)
            f.close()
        try:
        
                i = 1
                file_name_xml = 'footer'
                for footer in xml_tree_footer_list:
                    log.info("save_docx: opening:"+ file_name_xml + str(i) + '.xml')
                    with open(os.path.join(tmp_dir,'word/' + file_name_xml + str(i) + '.xml'), 'w') as f1:
                        xmlstr = etree.tostring(footer, encoding='unicode')
                        f1.write(xmlstr)
                        i = i + 1
                        f1.close()
                        log.info("save_docx: closing:"+ file_name_xml + str(i) + '.xml')
        except:
                log.error("save_docx: ERROR while writing footers")
        filenames = file.namelist()

        
    
    with zipfile.ZipFile(output_docx_filepath, "w") as docx:
        for filename in filenames:
            docx.write(os.path.join(tmp_dir, filename), filename)
    
    log.info('save_docx: saving modified document at ' +str(output_docx_filepath))

