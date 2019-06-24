from mongoengine import *

class Translation(Document):
    basename = StringField(required=True)
    source = StringField()
    target = StringField()
