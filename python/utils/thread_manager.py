import logging
import threading
from elastic_utils.elastic_search_indexer import sentence_creator
from utils.document_assembler import keep_on_running
from utils.document_writer import write_document

log = logging.getLogger('file')

MUST_RUNNING_THREADS = ['keep_on_running', 'write_document']


def thread_manager():
    thread_set = set()

    for t in threading.enumerate():
        LOG.debug('thread_manager : active threads are : ' + str(t.getName()))
        thread_set.add(t.getName())

    for thread in MUST_RUNNING_THREADS:
        if not thread_set.__contains__(thread):
            log.error('thread_manager : must running thread == ' + thread + 'is not running')
            # if thread is 'write_document':
            #     run_write_document()
            if thread is 'sentence_creator':
                run_sentence_creator()
            elif thread is 'keep_on_running':
                run_keep_on_running()


def run_sentence_creator():
    LOG.debug('run_sentence_creator : starting sentence_creator thread')
    t1 = threading.Thread(target=sentence_creator, name='sentence_creator')
    # t1.setDaemon(True)
    t1.start()


def run_write_document():
    LOG.debug('run_write_document : starting write_document thread')
    t1 = threading.Thread(target=write_document, name='write_document')
    # t1.setDaemon(True)
    t1.start()


def run_keep_on_running():
    LOG.debug('run_keep_on_running : starting keep_on_running thread')
    t1 = threading.Thread(target=keep_on_running, name='keep_on_running')
    # t1.setDaemon(True)
    t1.start()
