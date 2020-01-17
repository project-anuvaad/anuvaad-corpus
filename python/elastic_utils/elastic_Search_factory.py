from elasticsearch import Elasticsearch
import os
import logging

log = logging.getLogger('file')
elastic_search_hosts = 'ES_HOSTS'
default_value = 'localhost'
elastic_search_ports = '9200'


def get_elastic_search_client():
    es_hosts = None
    try:
        es_hosts = os.environ.get(elastic_search_hosts, default_value)
        LOG.debug('get_elastic_search_client elastic url == '+es_hosts)
        # if es_hosts is not None:
        #     es_hosts = es_hosts.spilit(',')
    except Exception as e:
        LOG.debug('get_elastic_search_client : creating connection to localhost')
        es_hosts = ['localhost']
        pass
    try:
        __client__ = Elasticsearch(hosts=[{'host':es_hosts,'port':elastic_search_ports}])
        return __client__
    except Exception as e:
        log.error('get_elastic_search_client : ERROR OCCURRED' + str(e))

