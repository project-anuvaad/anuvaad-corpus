import json
from kafka import KafkaProducer
import logging
import os

log = logging.getLogger('file')
kafka_ip_host = 'KAFKA_IP_HOST'
default_value = 'localhost:9092'
bootstrap_server = os.environ.get(kafka_ip_host, default_value)


def get_producer():
    try:
        producer = KafkaProducer(bootstrap_servers=[bootstrap_server],api_version=(1, 0, 0),
                                 value_serializer=lambda x: json.dumps(x).encode('utf-8'))
        LOG.debug('get_producer : producer returned successfully')
        return producer
    except Exception as e:
        log.error('get_producer : ERROR OCCURRED while creating producer, ERROR =  ' + str(e))
        return None
