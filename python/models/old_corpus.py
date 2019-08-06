"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-08-06 12:40:01
 * @modify date 2019-08-06 12:40:01
 * @desc [description]
 """

from mongoengine import *
import json


class Oldcorpus(Document):
    _id = ObjectIdField()
    corpusid = UUIDField()
    source = StringField()
    target = StringField()
    status = StringField()
    feedback = StringField()
    locked = BooleanField()
    locked_time = DateTimeField()
    updated_on = DateTimeField()
    updated_by = StringField()

    def limit(page_size, pagenumber=None):
        totalcount = Oldcorpus.objects.filter(Q(locked=None) or Q(locked=False)).count()
        if page_size is None:
            cursor = Oldcorpus.objects.filter(Q(locked=None) or Q(locked=False)).limit(5)
        elif pagenumber is None:
            cursor = Oldcorpus.objects.filter(Q(locked=None) or Q(locked=False)).limit(page_size)
        else:
            cursor = Oldcorpus.objects.filter(Q(locked=None) or Q(locked=False)).skip( (int(pagenumber)-1)*int(page_size) ).limit(int(page_size))

        # Get the data
        data = [x for x in cursor]

        if not data:
            # No documents left
            return None, None

        # Since documents are naturally ordered with _id, last document will
        # have max id.
        # last_id = data[-1]['_id']

        # Return data and last_id
        return cursor, totalcount
