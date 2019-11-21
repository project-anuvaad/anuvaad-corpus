from kafka_utils.consumer import get_consumer
from kafka_utils.producer import get_producer
from models.text_nodes import TextNode
from models.Document_nodes import DocumentNodes
import json
import logging

log = logging.getLogger('file')
TOPIC = 'listener'
TOPIC_TO_PROCESS = 'to-process'



def keep_on_running():
    consumer = get_consumer(TOPIC)
    try:
        for msg in consumer:
            try:
                message = msg.value['out']
                log.info('keep_on_running : message received = ' + str(message))
                sentences = message['response_body']
                status = message['status']
                if status['statusCode'] == 200:
                    if sentences is not None and not len(sentences) == 0:
                        process_sentence(sentences)
                else:
                    log.error('keep_on_running : ERROR OCCURRED : NMT SERVER ERROR '+str(status))
            except Exception as e:
                log.error('keep_on_running : ERROR OCCURRED : NMT SERVER ERROR '+str(e))
    except Exception as e:
        log.error('keep_on_running : ERROR OCCURRED : NMT SERVER ERROR '+str(e))
        


def process_sentence(sentences):
    log.info('process_sentence : started')
    sentence = sentences[0]
    node_id = sentence['n_id']
    text_node = TextNode.objects(node_id=node_id)
    if text_node is not None:
        text_node_dict = json.loads(text_node.to_json())
        log.info('process_sentence : text_node is ==' + str(text_node_dict))
        for sentence in sentences:
            log.info('process_sentence : sentence is =='+str(sentence))
            s_id = sentence['s_id']
            text = sentence['tgt']
            sen = {'tgt': text, 's_id': s_id}
            log.info('process_sentence : sen objects is = '+str(sen))

            text_node_dict[0]['sentences'].append(sen)
        ttl_sentences = len(sentences)
        ttl_sentences = text_node_dict[0]['tokens_received'] + ttl_sentences
        completed = False
        if ttl_sentences == text_node_dict[0]['tokens_sent']:
            completed = True
            basename = text_node_dict[0]['basename']
            doc_nodes = DocumentNodes.objects(basename=basename)
            doc_nodes_dict = json.loads(doc_nodes.to_json())
            nodes_received = doc_nodes_dict[0]['nodes_received']
            nodes_sent = doc_nodes_dict[0]['nodes_sent']
            log.info('process_sentence : nodes sent ='+str(nodes_sent))
            nodes_received = nodes_received + 1
            log.info('process_sentence : nodes_received ='+str(nodes_received))
            if nodes_received == nodes_sent:
                log.info('process_sentence : producing nodes for writing')
                doc_nodes.update(set__nodes_received=nodes_received, is_complete=True)
                producer = get_producer()
                producer.send(TOPIC_TO_PROCESS, value=basename)
                producer.flush()
                producer.close()
            doc_nodes.update(set__nodes_received=nodes_received)
        text_node.update(set__sentences=text_node_dict[0]['sentences'],
                         set__tokens_received=ttl_sentences, set__is_complete=completed)
