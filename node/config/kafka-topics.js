

exports.KafkTopics = {
    NMT_TRANSLATE: process.env.KAFKA_NMT_TRANSLATE ? process.env.KAFKA_NMT_TRANSLATE : 'nmt_translate',
    TOKEN_PROCESSESED: 'tokenprocessed',
    NMT_TRANSLATE_PROCESSED: process.env.KAFKA_NMT_TRANSLATE_PROCESSED ? process.env.KAFKA_NMT_TRANSLATE_PROCESSED : 'nmt_translate_processed',
}