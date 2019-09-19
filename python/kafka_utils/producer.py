import json
from kafka import KafkaProducer
import logging

log = logging.getLogger('file')


def get_producer():
    try:
        producer = KafkaProducer(bootstrap_servers=['localhost:9092'],
                                 value_serializer=lambda x: json.dumps(x).encode('utf-8'))
        log.info('get_producer : producer returned successfully')
        return producer
    except Exception as e:
        log.error('get_producer : ERROR OCCURRED while creating producer, ERROR =  ' + str(e))
        return None

