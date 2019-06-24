from mongoengine import *

class TranslationProcess(Document):
    name = StringField(required=True)
    created_on = StringField()
    status = StringField()
    basename = StringField()
