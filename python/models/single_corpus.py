"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-08-22 12:40:01
 * @modify date 2019-08-22 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class Corpussentence(EmbeddedDocument):
    sentence = StringField()

class Singlecorpus(Document):
    name = StringField(required=True)
    domain = StringField()
    lang = StringField()
    created_on = StringField()
    last_modified = StringField()
    comment = StringField()
    author = StringField()
    no_of_sentences = IntField()
    status = StringField()
    corpusid = StringField()
    sentences = ListField(EmbeddedDocumentField(Corpussentence))




