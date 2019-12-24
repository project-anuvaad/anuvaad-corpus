import yaml
import logging
import csv
import re
import nltk

log = logging.getLogger('file')

REGEX_RULES = 'regex_rules_for_token_extraction'
TOKEN_LENGTH_MAX = 'token_length_max'
TOKEN_LENGTH_MIN = 'token_length_min'
USE_TOKENS_FROM_DB = 'use_tokens_from_db'
REMOVE_NEGATIVE_TOKEN = 'remove_negative_tokens'
ADD_NEGATIVE_TOKENS = 'add_negative_tokens'

CSV_RT = 'rt'
CSV_WRITE = 'w'
CONFIG_FILE_LOCATION = 'config_file_location'
TOKEN_FILE = 'token_file'
NEGATIVE_TOKEN_FILE_PATH = 'resources/negative_tokens.csv'


def create_custom_nltk_tokenizer(text_nodes):
    try:
        log.info('create_custom_nltk_tokenizer : started ')
        tokens = get_extracted_tokens(text_nodes)
        log.info('create_custom_nltk_tokenizer : tokens list length is == ' + str(len(tokens)))
        if len(tokens) == 0:
            return None
        else:
            tokenizer = load_tokenizer(tokens)
            log.info('create_custom_nltk_tokenizer : tokenizer returned')
            return tokenizer
    except Exception as e:
        log.error('create_custom_nltk_tokenizer : Error occurred while creating a custome tokenizer , '
                  'ERROR is == ' + str(e))
        return None


def get_extracted_tokens(text_nodes):
    try:
        log.info('get_extracted_tokens : process started ')
        config = read_config_file()

        regex_rules_for_token_extraction = config[REGEX_RULES]
        token_length_max = config[TOKEN_LENGTH_MAX]
        token_length_min = config[TOKEN_LENGTH_MIN]
        remove_negative_tokens = config[REMOVE_NEGATIVE_TOKEN]
        add_negative_tokens = config[ADD_NEGATIVE_TOKENS]

        tokens = extract_tokens(regex_rules_for_token_extraction, text_nodes)

        tokens = apply_length_rules(tokens, token_length_min, token_length_max)

        negative_tokens = read_from_csv(NEGATIVE_TOKEN_FILE_PATH)
        if remove_negative_tokens:
            log.info('get_extracted_tokens : removing negative tokens')
            negative_tokens = negative_tokens.__add__(add_negative_tokens)
            tokens = [x for x in tokens if x not in negative_tokens]
            log.info('get_extracted_tokens : negative tokens removed')
        return tokens
    except Exception as e:
        log.error('get_extracted_tokens : Error Occurred while extracting tokens')
        log.error('get_extracted_tokens : ERROR is == ' + str(e))
        log.info('get_extracted_tokens : Returning empty list')
        tokens = []
        return tokens


def extract_tokens(regexRules, text_nodes):
    all_tokens = set()
    for text_node in text_nodes:
        if text_node.text is not None:
            tokens = apply_regex_rules(text_node.text, regexRules)
            for token in tokens:
                all_tokens.add(token)

    return all_tokens


def read_config_file(filepath='resources/token_ext_config.yaml'):
    with open(filepath) as file:
        # The FullLoader parameter handles the conversion from YAML
        # scalar values to Python the dictionary format
        config = yaml.load(file, Loader=yaml.FullLoader)
        log.info('read_config_file : filepath is == ' + str(filepath))
        log.info('read_config_file : config is == ' + str(config))
        return config


def apply_regex_rules(text, regexRules):
    all_tokens = set()
    for rule in regexRules:
        text = text.lower()
        tokens = [x.group() for x in re.finditer(rule, text)]
        for t in tokens:
            all_tokens.add(t)
    return all_tokens


def apply_length_rules(tokens, min_length, max_length):
    all_tokens = set()
    for token in tokens:
        if token[-1] == "." and min_length < token.__len__() < max_length:
            token = token[0: -1]
            if not token.__contains__('.') and token.__len__() < 4:
                all_tokens.add(token)
            elif token.__contains__('.'):
                all_tokens.add(token)

    return all_tokens


def read_from_csv(filepath):
    file_data = []
    with open(filepath, CSV_RT) as file:
        data = csv.reader(file)
        for row in data:
            text = row[0]
            file_data.append(text)
        file.close()
    return file_data


def load_tokenizer(tokens):
    tokenizer = get_tokenizer_english_pickle()
    tokenizer = update_english_pickle_with_tokens(tokenizer, tokens)
    return tokenizer


def get_tokenizer_english_pickle():
    log.info('get_tokenizer_english_pickle : loading tokenizers/punkt/english.pickle ')
    tokenizer = nltk.data.load('tokenizers/punkt/english.pickle')
    log.info('get_tokenizer_english_pickle : loading completed for tokenizers/punkt/english.pickle ')
    return tokenizer


def update_english_pickle_with_tokens(tokenizer, tokens):
    log.info('update_english_pickle_with_tokens : updating tokenizer')
    for token in tokens:
        tokenizer._params.abbrev_types.add(token)
    log.info('update_english_pickle_with_tokens : tokenizer updated')
    return tokenizer
