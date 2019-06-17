from mongoengine import *
connect('preprocessing')

class Sentence(Document):
    basename = StringField(required=True)
    source = StringField()
    target = StringField()
    target_ocr = StringField()
    source_ocr = StringField()
    alignment_accuracy = StringField()
