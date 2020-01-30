"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class TranslationProcess(DynamicDocument):
    name = StringField(required=True)
    created_on = StringField()
    status = StringField()
    basename = StringField()
    sourceLang = StringField()
    targetLang = StringField()
    created_by = StringField()
    translate_uploaded = BooleanField()
    eta = IntField()
    feedback_pending = BooleanField()
