"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from mongoengine import *

class Sentence(DynamicDocument):
    basename = StringField()
    _id = ObjectIdField()
    source = StringField()
    target = StringField()
    target_ocr = StringField()
    source_ocr = StringField()
    status = StringField()
    target_ocr_words = ListField()
    source_ocr_words = ListField()
    alignment_accuracy = StringField()
    corpusid = UUIDField()
    feedback = StringField()
    locked = BooleanField()
    locked_time = DateTimeField()
    updated_on = DateTimeField()
    updated_by = StringField()
    source_t = StringField()
    rating = FloatField()

    def limit(page_size, basename, status=None,pagenumber=None):
        if status is not None:
            totalcount = Sentence.objects.filter(Q(basename=basename) and Q(status=status)).count()
        else:
            totalcount = Sentence.objects.filter(Q(basename=basename)).count()
        if page_size is None:
            if status is not None:
                cursor = Sentence.objects.filter(Q(basename=basename) and Q(status=status)).limit(5)    
            else:
                cursor = Sentence.objects.filter(Q(basename=basename)).limit(5)
        elif pagenumber is None:
            if status is not None:
                cursor = Sentence.objects.filter(Q(basename=basename) and Q(status=status)).limit(page_size)
            else:
                cursor = Sentence.objects.filter(Q(basename=basename)).limit(page_size)
        else:
            if status is not None:
                cursor = Sentence.objects.filter(Q(basename=basename) and Q(status=status)).skip( (int(pagenumber)-1)*int(page_size) ).limit(int(page_size))
            else:
                cursor = Sentence.objects.filter(Q(basename=basename)).skip( (int(pagenumber)-1)*int(page_size) ).limit(int(page_size))

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