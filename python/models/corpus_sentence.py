"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-08-22 12:40:01
 * @modify date 2019-08-22 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class Corpussentence(DynamicDocument):
    sentence = StringField()
    index = IntField()