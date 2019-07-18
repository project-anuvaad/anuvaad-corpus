import zipfile
from lxml import etree
import uuid 
import tempfile
import os
import shutil
import codecs
import requests

translate_url = 'http://52.40.71.62:3003/translator/translation_en'
max_calls = 25

def get_xml_tree(xml_string):
    return etree.fromstring(xml_string)

def get_file_info(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
                print(file.printdir())
    else:
        print('docx_translate_helper:get_file_info : filename ' +str(filename) + ' is not a zip file')
        
def get_document_xml(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
            print('docx_translate_helper:get_document_xml : Extracting all files...')
            file.extractall()
            print('Done!')
            xml_content = file.read('word/document.xml')
            return xml_content
    else:
        return None
def get_endnote_xml(filename):
    try:    
        if zipfile.is_zipfile(filename):
            with zipfile.ZipFile(filename) as file:
                print('docx_translate_helper:get_endnote_xml : Extracting all files...')
                file.extractall()
                print('Done!')
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
        if check_element_is(node, 't'):
            yield (node, node.text)
def itertext_1(xmltree):
    """Iterator to go through xml tree's text nodes"""
    for node in xmltree.iter(tag=etree.Element):
        if check_element_is(node, 't'):
            yield (node, node.text)            

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
        arr.append({'src': node.text, 'id': 1})

        print('docx_translate_helper:modify_text : node text before translation :' +node.text)

        if(arr.__len__ == max_calls):
            try :    
                res = requests.post(translate_url, json=arr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    print('docx_translate_helper:modify_text : ') 
                    print( dictFromServer['response_body'])
                    for translation in dictFromServer['response_body']:
                        try : 
                            # print('docx_translate_helper:modify_text : recieved translating from server : ') 
                            # print(translation)
                            results.append(translation)
                        except:
                            print("docx_translate_helper:modify_text : ERROR : while adding to the results list")
                            results.append({'text':None})    
                
            except: 
                print('docx_translate_helper:modify_text : ERROR : while getting data from translating server ')
                pass   
            arr = []
        arr_len = arr.__len__
    if not (arr.__len__ ==  0):
            try :    
                res = requests.post(translate_url, json=arr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    print('docx_translate_helper:modify_text : ') 
                    print( dictFromServer['response_body'])
                    for translation in dictFromServer['response_body']:
                        try : 
                            # print('docx_translate_helper:modify_text : recieved translating from server : ') 
                            # print(translation)
                            results.append(translation)
                        except:
                            print("docx_translate_helper:modify_text : ERROR : while adding to the results list")
                            results.append({'text':None})    
                
            except: 
                print('docx_translate_helper:modify_text : ERROR : while getting data from translating server for less than 25 batch size ')
    i = 0 
    print('docx_translate_helper:modify_text : following are the text and its translation')          
    for node in nodes:
        print(node.text + '\n')
        node.text = results[i]['tgt']   
        print(node.text + '\n')
        i = i + 1

def save_docx(input_docx_filepath, xmltree, output_docx_filepath):
    tmp_dir = tempfile.mkdtemp()
    print('docx_translate_helper:save_docx : Extracting '+ str(input_docx_filepath) +' in temp directory ' +tmp_dir)
    if not zipfile.is_zipfile(input_docx_filepath):
        print('docx_translate_helper:save_docx : '+str(input_docx_filepath) +' is not valid filepath')
        return None

    filenames = []
    with zipfile.ZipFile(input_docx_filepath) as file:
        file.extractall(tmp_dir)
        with open(os.path.join(tmp_dir,'word/document.xml'), 'w') as f:
            xmlstr = etree.tostring(xmltree, encoding='unicode')
            f.write(xmlstr)
            filenames = file.namelist()
        
    
    with zipfile.ZipFile(output_docx_filepath, "w") as docx:
        for filename in filenames:
            docx.write(os.path.join(tmp_dir, filename), filename)
    
    print('docx_translate_helper:save_docx : saving modified document at ' +str(output_docx_filepath))

