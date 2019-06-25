"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from db.conmgr import getinstance
from elasticsearch.helpers import bulk, streaming_bulk
import json


def fetchwordsfromsentence(sentence, timstamp):
    if len(sentence) > 0:
        words = sentence.split(' ')
        point = 0
        count = 0
        values = []
        for i in range(0, len(words)):
            next_word = ''
            previous = ''
            if i is not 0:
                previous = words[i-1]
            if i is not len(words) - 1:
                try:
                    next_word = words[i+1]
                except Exception as e:
                    print(e)
            result = search(words[i], previous, next_word, timstamp)

            if int(result['hits']['total']['value']) > 0:
                count += 1
                point += int(result['hits']['hits'][0]
                             ['_source']['doc']['word']['conf'])
                values.append(
                    int(result['hits']['hits'][0]['_source']['doc']['word']['conf']))
            else:
                values.append(0)
        if count > 0:
            point = point / count
        return {'avg': point, 'values': values}
    return {'avg': 0, 'values': []}


def search(text, previous, next_word, timestamp):
    es = getinstance()
    """Simple Elasticsearch Query"""
    response = es.search(index="words", body={
        "query": {
            "bool": {
                         "must": [
                             {
                                 "match": {
                                     "doc.word.text": text
                                 }
                             },
                             {
                                 "match": {
                                     "doc.word.timestamp": timestamp
                                 }
                             }
                         ],
                         "should": [
                             {
                                 "match": {
                                     "doc.word.next": next_word,
                                 }
                             },
                             {
                                 "match": {
                                     "doc.word.previous": previous,
                                 }
                             }
                         ]
                         },


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
