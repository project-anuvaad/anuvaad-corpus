"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class TranslationProcess(Document):
    name = StringField(required=True)
    created_on = StringField()
    status = StringField()
    basename = StringField()
