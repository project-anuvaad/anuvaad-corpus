from flask import current_app as app
import nltk
import logging
import csv

log = logging.getLogger('file')

NEGATIVE_TOKEN_FILE_NAME = 'resources/negative_tokens.csv'
POSITIVE_TOKEN_FILE_NAME = 'resources/positive_tokens.csv'
EXCLUSIVE_TOKEN_FILE_NAME = 'resources/exclusive_tokens.csv'


def update_english_pickle_with_tokens(tokens):
    def get_tokenizer_english_pickle():
        log.info('get_tokenizer_english_pickle : loading tokenizers/punkt/english.pickle ')
        tokenizer = nltk.data.load('tokenizers/punkt/english.pickle')
        log.info('get_tokenizer_english_pickle : loading completed for tokenizers/punkt/english.pickle ')
        return tokenizer

    def get_tokens_from_file(file):
        data = read_data_from_csv(file)
        return data

    def clean_tokens(tokens_, negative_tokens_, eclusive_tokens_):
        tokens_ = [x for x in tokens_ if x not in negative_tokens_]
        for token_ in eclusive_tokens_:
            tokens_.append(token_)
        return tokens_
    positive_tokens = get_tokens_from_file(POSITIVE_TOKEN_FILE_NAME)
    negative_tokens = get_tokens_from_file(NEGATIVE_TOKEN_FILE_NAME)
    exclusive_tokens = get_tokens_from_file(EXCLUSIVE_TOKEN_FILE_NAME)
    tokens = positive_tokens.__add__(tokens)
    cleaned_tokens = clean_tokens(tokens, negative_tokens, exclusive_tokens)
    tokenizer = get_tokenizer_english_pickle()
    log.info('update_english_pickle_with_tokens : updating tokenizer')

    for token in cleaned_tokens:
        tokenizer._params.abbrev_types.add(token)

    log.info('update_english_pickle_with_tokens : tokenizer updated')
    return tokenizer


def load_tokenizer(tokens):
    log.info('load_tokenizer : started ')
    tokenizer = update_english_pickle_with_tokens(tokens)
    log.info('load_tokenizer : ended ')
    return tokenizer


#
# class BulletPointLangVars(PunktLanguageVars):
#     sent_end_chars = ('.', '?', '!', ';')


# Token Extraction
def read_data_from_csv(filepath):
    tokens = []
    with app.open_resource(filepath, 'r') as file:
        data = csv.reader(file)
        for row in data:
            text = row[0]
            tokens.append(text)
        file.close()
    return tokens
