from producer import get_producer
from consumer import get_consumer
import json


def abc():
    print('abc called')
    i =0
    c = get_consumer('to-nmt')
    p = get_producer()
    for msg in c:
        print('count == '+str(i))
        i =i +1
        sentences = json.loads(msg.value)
        if sentences is not None and len(sentences) is not 0:
            for sen in sentences:
                print(sen)



abc()