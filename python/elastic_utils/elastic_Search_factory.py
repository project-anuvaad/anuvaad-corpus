from elasticsearch import Elasticsearch
import os
import logging

log = logging.getLogger('file')
elastic_search_hosts = 'es_hosts'
elastic_search_ports = '9200'


def get_elastic_search_client():
    es_hosts = None
    try:
        es_hosts = os.environ(elastic_search_hosts)
        if es_hosts is not None:
            es_hosts = es_hosts.spilit(',')
    except Exception as e:
        log.info('get_elastic_search_client : creating connection to localhost')
        es_hosts = ['localhost']
        pass
    try:
        __client__ = Elasticsearch(hosts=es_hosts)
        return __client__
    except Exception as e:
        log.error('get_elastic_search_client : ERROR OCCURRED' + str(e))

