import logging as log
import os
import zipfile
from xml.etree.ElementTree import ElementTree

from lxml import etree
from lxml import html as ht

import parser
import document_classes as SCHEMA

from Docx_Enums import DocumentPart as DP

# log = logging

print(DP.Document.value)

root = etree.Element("html")
body = etree.Element("body")
para = etree.Element("p")
para.text = "happy"
para.attrib['style'] = "color:red"
print(dir(para))
body.append(para)
root.append(body)
print(etree.tostring(root, encoding='unicode'))


def process_document_xml(file):
    log.info('process_document_xml: started ')
    xml_tree = get_xml_tree(file)
    for node in xml_tree.iter(tag=etree.Element):
        node_type = get_element_type(node)
        if node_type == DP.tag_body.value:

            for element in node.iterchildren():
                element_tag = get_element_type(element)
                if element_tag == DP.tag_para.value:
                    process_pragraph(element)
                elif element_tag == DP.tag_table.value:
                    process_table(element)
                elif element_tag == DP.tag_sectPr.value:
                    process_section(element)


def process_table():
    return None


def process_pragraph():
    return None


def process_section():
    return None


def get_element_type(element):
    if element.tag == DP.tag_body.value:
        return DP.tag_body.value


def get_xml_tree(xml_string):
    return etree.fromstring(xml_string)


def get_xml_files(filepath):
    files = {}
    print(filepath)
    if zipfile.is_zipfile(filepath):

        with zipfile.ZipFile(filepath) as file:
            log.info('get_xml_files: Extracting all files...')
            file.extractall()
            log.info('get_xml_files: Extracting all files... Done!')
            doc_xml = file.read(DP.Document.value)
            files.update({DP.docx_xml.value: doc_xml})
            styles_xml = file.read(DP.Style.value)
            files.update({DP.style_xml.value: styles_xml})
            fonttable_xml = file.read(DP.FontTable.value)
            files.update({DP.fonttable_xml.value: fonttable_xml})
            settings_xml = file.read(DP.Settings.value)
            files.update({DP.settings_xml.value: settings_xml})
            doc_rel_xml = file.read(DP.DocumentRelations.value)
            files.update({DP.docx_rel_xml.value: doc_rel_xml})
            try:
                doc_font_rel = file.read(DP.FontRelations.value)
                files.update({DP.font_rel_xml.value: doc_font_rel})
            except:
                log.info('get_xml_files: no font relation file present')
                files.update({DP.font_rel_xml.value: None})
            try:
                doc_num_rel = file.read(DP.NumberingRelations.value)
                files.update({DP.num_rel_xml.value: doc_num_rel})
            except:
                log.info('get_xml_files: no number relation file present')
                files.update({DP.num_rel_xml.value: None})
            return files
    else:
        log.error('get_xml_files: error while unzipping, for file: ' + filepath)


def process_rels(file):
    log.info('process_document_rels: started ')
    if file is None:
        return None
    xml_tree = get_xml_tree(file)
    doc_rels = {}
    doc_rel = []
    xml_tree = get_xml_tree(file)
    for node in xml_tree.iter(tag=etree.Element):
        print(node.nsmap)
        if node.tag == DP.tag_relationship.value:
            d = SCHEMA.DocRel(node.attrib['Id'], node.attrib['Type'], node.attrib['Target'])
            doc_rels.update({d.id: d})
            doc_rel.append(d)
    log.info('process_document_rels: ended ')
    return doc_rel


def process_doc_styles(file):
    results = []
    log.info('process_doc_styles: started ')
    if file is None:
        log.info('process_doc_styles: file is None ')
        return None
    xml_tree = get_xml_tree(file)
    for node in xml_tree.iter(tag=etree.Element):
        print(node.tag)
        if node.tag == DP.tag_styles.value:

            for child in node.iterchildren():
                if child.tag == DP.tag_docDefaults.value:
                    results.append(parser.parse_default_style(child))
                elif child.tag == DP.tag_style.value:
                    results.append(parser.parseStyle(child))
    log.info('process_doc_styles: ended ')
    return results


def process_doc_numbering(file):
    results = []
    log.info('process_doc_numbering: started ')
    if file is None:
        log.info('process_doc_numbering: file is NULL ')
        return None
    xml_tree = get_xml_tree(file)
    result = []
    mapping = {}
    bullets = []

    for node in xml_tree.iter(tag=etree.Element):
        if node.tag == DP.tag_abstractNum.value:
            res = parser.parseAbstractNumbering(node, bullets)
            for r in res:
                result.append(r)
        elif node.tag == DP.tag_numPicBullet.value:
            bullets.append(parser.parseNumberingPicBullet(node))
        elif node.tag == DP.tag_num.value:
            numId = node.attrib[DP.tag_numId.value]
            absnumId = parser.elementStringAttr(node, DP.tag_abstractNumId.value, DP.tag_val.value)
            mapping[absnumId] = numId

        for r in result:
            r.id = mapping[r.id]

        return result


def convert_to_html(path, filename):
    filepath = os.path.join(
        path + filename + '.docx')
    xml_files = get_xml_files(filepath)
    print(DP.docx_rel_xml.value)
    document = SCHEMA.Document()
    document.docRelations = process_rels(xml_files[DP.docx_rel_xml.value])
    document.fontRelations = process_rels(xml_files[DP.font_rel_xml.value])
    document.numRelations = process_rels(xml_files[DP.num_rel_xml.value])
    document.styles = process_doc_styles(xml_files[DP.style_xml.value])
    document.numbering = process_doc_numbering(xml_files[DP.style_xml.value])
    document.document = process_document_xml(xml_files[DP.docx_xml.value])
    print(document.docRelations)


# process_document_xml(xml_files[DP.docx_xml.value])

convert_to_html('../upload/', '1563472850')
