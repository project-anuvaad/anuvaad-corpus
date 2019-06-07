from db.conmgr import getinstance
from elasticsearch.helpers import bulk, streaming_bulk


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
