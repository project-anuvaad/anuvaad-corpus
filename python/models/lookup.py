from mongoengine import *

class Lookup(Document):
    text = StringField(required=True)
    value = StringField()
    
