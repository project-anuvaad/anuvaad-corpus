import json
from kafka import KafkaProducer
import logging
import os

log = logging.getLogger('file')
kafka_ip_host = 'kafka_ip_host'
default_value = 'localhost:9092'
bootstrap_server = os.environ.get(kafka_ip_host, default_value)


def get_producer():
    try:
        producer = KafkaProducer(bootstrap_servers=[bootstrap_server],
                                 value_serializer=lambda x: json.dumps(x).encode('utf-8'))
        log.info('get_producer : producer returned successfully')
        return producer
    except Exception as e:
        log.error('get_producer : ERROR OCCURRED while creating producer, ERROR =  ' + str(e))
        return None
