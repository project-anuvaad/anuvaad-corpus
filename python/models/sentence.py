from mongoengine import *

class Sentence(Document):
    basename = StringField(required=True)
    source = StringField()
    target = StringField()
    target_ocr = StringField()
    source_ocr = StringField()
    status = StringField()
    alignment_accuracy = StringField()
