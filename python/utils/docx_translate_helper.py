import zipfile
from lxml import etree
import uuid 
import tempfile
import os
import shutil
import codecs
import requests

def get_xml_tree(xml_string):
    return etree.fromstring(xml_string)

def get_file_info(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
                print(file.printdir())
    else:
        print('filename' +str(filename) + 'is not a zip file')
        
def get_document_xml(filename):
    if zipfile.is_zipfile(filename):
        with zipfile.ZipFile(filename) as file:
            print('Extracting all files...')
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
                print('Extracting all files...')
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
    ''' adding translation id for each node '''
    for node, text in itertext(xmltree):
        node.attrib['id'] = identifier
       
      
def modify_text(xmltree):
    for node, text in itertext(xmltree):
        arr = []
        
        arr.append({'src': text, 'id': 1})
            # print(hindiarr)
        res = requests.post('http://52.40.71.62:3003/translator/translation_en', json=arr)
        dictFromServer = res.json()
        if dictFromServer['response_body'] is not None:
            print(dictFromServer['response_body'])
            for translation in dictFromServer['response_body']:
                print(translation)
            # if len(translation['tgt']) > 0 and translation['tgt'] != '\n':
                node.text  = (translation['tgt'])
        print(text)
        print(node.text)

def save_docx(input_docx_filepath, xmltree, output_docx_filepath):
    tmp_dir = tempfile.mkdtemp()
    print('Extracting '+ str(input_docx_filepath) +' in temp directory ' +tmp_dir)
    if not zipfile.is_zipfile(input_docx_filepath):
        print(str(input_docx_filepath) +'is not valid filepath')
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
    
    print(' saving modified document at ' +str(output_docx_filepath))
