"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class Parallelcorpus(DynamicDocument):
    name = StringField(required=True)
    domain = StringField()
    source_id = StringField()
    target_id = StringField()
    source_lang = StringField()
    target_lang = StringField()
    created_on = DateTimeField()
    last_modified = DateTimeField()
    comment = StringField()
    author = StringField()
    no_of_sentences = IntField()
    status = StringField()
    basename = StringField()
