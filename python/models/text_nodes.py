from mongoengine import *


class TextNode(Document):
    node_id = StringField()
    lang = StringField()
    sentences = ListField(DictField())
    created_date = StringField()
    tokens_sent = IntField()
    tokens_received = IntField()
    is_complete = BooleanField()
    basename = StringField()