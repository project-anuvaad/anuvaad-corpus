"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class Benchmark(Document):
    name = StringField(required=True)
    source_lang = StringField()
    created_on = StringField()
    last_modified = StringField()
    author = StringField()
    no_of_sentences = IntField()
    status = StringField()
    basename = StringField()
    assigned_to = StringField()
