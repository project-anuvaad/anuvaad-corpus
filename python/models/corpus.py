from mongoengine import *

class Corpus(Document):
    name = StringField(required=True)
    domain = StringField()
    created_on = StringField()
    last_modified = StringField()
    comment = StringField()
    author = StringField()
    no_of_sentences = IntField()
    status = StringField()
    basename = StringField()
