import zipfile
from lxml import etree
import utils.docx_translate_helper as docx_translate_helper
import tempfile
import os
import shutil
import codecs
import logging

log = logging.getLogger('file')
footer_file_name = 'footer'
footer_file_ext = '.xml'


def get_xml_tree(xml_string):
    return etree.fromstring(xml_string)

def translate_footer(filename, model_id, url_end_point):
    footers = []
    has_more = True
   
    try:    
        if zipfile.is_zipfile(filename):
            with zipfile.ZipFile(filename) as file:
                LOG.debug('translate_footnote:get_footer_xml_list : Extracting all files...')
                file.extractall()
                LOG.debug('Done!')
                i = 1
                while has_more :    
                    try :    
                        LOG.debug('translate_footnote:get_footer_xml_list : reading file :'+'word/'+footer_file_name +str(i) + '.xml' )
                        xml_content = file.read('word/'+footer_file_name + str(i)+ '.xml')
                        footer = get_xml_tree(xml_content)
                        footers.append(footer)
                        nodes = []
                        for node in iter_footers(footer):
                            nodes.append(node)
                        docx_translate_helper.modify_text_with_tokenization(nodes, None, model_id, url_end_point)

                        i = i +1
                    except :
                        log.info ('translate_footnote:get_footer_xml_list : exception in reading file after : '+ 'word/'+footer_file_name + i + footer_file_ext)    
                        has_more = False
        else:
            return None    
    except :
            log.info ('translate_footnote:get_footer_xml_list : exception orrcued ') 
            pass

    return footers

def check_element_is(element, type_char):
    word_schema = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    return element.tag == '{%s}%s' % (word_schema, type_char)

def iter_footers(xmltree):
    """Iterator to go through xml tree's text nodes"""
    for node in xmltree.iter(tag=etree.Element):
        if check_element_is(node, 't'):
            yield (node)