from mongoengine import *

class Sentence(Document):
    basename = StringField(required=True)
    source = StringField()
    target = StringField()
    target_ocr = StringField()
    source_ocr = StringField()
    status = StringField()
    target_ocr_words = ListField()
    source_ocr_words = ListField()
    alignment_accuracy = StringField()
