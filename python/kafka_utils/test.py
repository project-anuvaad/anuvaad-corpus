from producer import get_producer
from consumer import get_consumer
import json

c = get_consumer('qwe')
p = get_producer()
for msg in c:
    sentences = json.loads(msg.value)
    print(sentences)
    if sentences is not None and len(sentences) is not 0:
        for sen in sentences:
            print(sen)
            sen['tgt'] = 'example'
        p.send('abc', value=sentences)
        p.flush()