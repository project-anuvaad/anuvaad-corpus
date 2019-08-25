from lxml import etree
import zipfile
from Docx_Enums import DocumentPart


def get_xml_tree(xml_string):
    return etree.fromstring(xml_string)


def process_document_xml(file):
    xml_tree = get_xml_tree(file)
    for node in xml_tree.iter(tag=etree.Element):
        print(node.tag)


def get_xml_files(filepath):
    print(filepath)
    if zipfile.is_zipfile(filepath):
        with zipfile.ZipFile(filepath) as file:
            file.extractall()

            doc_xml = file.read(DocumentPart.Numbering.value)
            process_document_xml(doc_xml)


get_xml_files('./test/demo.docx')
