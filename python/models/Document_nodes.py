from mongoengine import *


class DocumentNodes(Document):
    basename = StringField()
    total_nodes = IntField()
    nodes_sent = IntField()
    nodes_received = IntField()
    is_complete = BooleanField()
    created_date = StringField()
