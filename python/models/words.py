from db.conmgr import getinstance
from elasticsearch.helpers import bulk, streaming_bulk
import json


def fetchwordsfromsentence(sentence, timstamp):
    if len(sentence) > 0 :
        words = sentence.split(' ')
        point = 0
        count = 0
        for i in range(0, len(words)):
            next_word = ''
            previous = ''
            if i is not 0:
                previous = words[i-1]
            if i is not len(words) - 1:
                next_word = words[i+1]
            result = search(words[i], previous, next_word, timstamp)

            if int(result['hits']['total']['value']) > 0:
                count += 1
                point += int(result['hits']['hits'][0]['_source']['doc']['word']['conf'])
        if count > 0:
            point = point / count
        return point
    return 0


def search(text, previous, next_word, timestamp):
    es = getinstance()
    """Simple Elasticsearch Query"""
    response = es.search(index="words", body={
        "query": {
            "bool": {
                "must": [
                    {"term": {"doc.word.text": text}},
                    {"term": {"doc.word.next": next_word}},
                    {"term": {"doc.word.timestamp": timestamp}},
                    {"term": {"doc.word.previous": previous}}
                ]
            }
        }
    })
    # results = json.loads(response)
    return response


def savewords(words):
    es = getinstance()
    bulk(es, gendata(words))


def gendata(words):
    for word in words:
        yield {
            "_index": "words",
            "_type": "document",
            "doc": {"word": word},
        }


# fetchwordsfromsentence('In this chapter we will look at some of these debates.:::::BLEU', '1559903727')