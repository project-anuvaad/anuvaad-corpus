"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-08-22 12:40:01
 * @modify date 2019-08-22 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class Singlecorpus(DynamicDocument):
    name = StringField(required=True)
    domain = StringField()
    lang = StringField()
    created_on = DateTimeField()
    last_modified = DateTimeField()
    comment = StringField()
    description = StringField()
    author = StringField()
    no_of_sentences = IntField()
    status = StringField()
    corpusid = StringField()




