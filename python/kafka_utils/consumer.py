from kafka import KafkaConsumer
import logging
import json
import os

log = logging.getLogger('file')
kafka_ip_host = 'KAFKA_IP_HOST'
default_value = 'localhost:9092'
bootstrap_server = os.environ.get(kafka_ip_host, default_value)


def get_consumer(topic):
    try:
        consumer = KafkaConsumer(
            topic,
            bootstrap_servers=[bootstrap_server],
            auto_offset_reset='earliest',
            enable_auto_commit=True,
            group_id='anuvaad',
            value_deserializer=lambda x: handle_json(x))

        log.info('get_consumer : consumer returned for topic = ' + topic)
        return consumer
    except Exception as e:
        log.error('get_consumer : ERROR OCCURRED for getting consumer with topic = ' + topic)
        log.error('get_consumer : ERROR = ' + str(e))
        print('error')
        return None


def handle_json(x):
    try:
        return json.loads(x.decode('utf-8'))
    except Exception as e:
        return {}
