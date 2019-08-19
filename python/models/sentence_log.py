"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-08-19 12:40:01
 * @modify date 2019-08-19 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class Sentencelog(Document):
    basename = StringField()
    source = StringField()
    target = StringField()
    source_edited = StringField()
    parent_id = StringField()
    target_edited = StringField()
    edited_by = StringField()
    source_words = ListField(StringField())
    target_words = ListField(StringField())
    source_edited_words = ListField(StringField())
    target_edited_words = ListField(StringField())
