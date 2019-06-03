from elasticsearch import Elasticsearch

es = Elasticsearch()

def getinstance():
    return es