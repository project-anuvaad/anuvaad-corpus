from flask import Flask, current_app as app
import yaml
import logging
import os
import re

log = logging.getLogger('file')

CONFIG_PATH = '../resources/'
REGEX_RULES = 'regex_rules'
TOKEN_LENGTH_MAX = 'token_length_max'
TOKEN_LENGTH_MIN = 'token_length_min'
CSV_RT = 'r'
RESOURCE = 'resource'
filepath = 'resources/token_ext_config.yaml'
# app = Flask(__name__)
# with app.app_context():
#     filepath = os.path.join(app.config['resource'], 'token_ext_config.yaml')


def get_tokens(texts):
    log.info('get_tokens: started')
    config = read_config_file()
    regex_rules_for_token_extraction = config[REGEX_RULES]
    token_length_max = config[TOKEN_LENGTH_MAX]
    token_length_min = config[TOKEN_LENGTH_MIN]
    tokens = list()

    for text in texts:
        tokens_ = extract_tokens(regex_rules_for_token_extraction, text)
        tokens = tokens.__add__(tokens_)
    tokens = apply_length_rules(tokens, token_length_min, token_length_max)
    log.info('get_tokens: ended')
    return tokens


def read_config_file():
    with app.open_resource(filepath) as file:
        # The FullLoader parameter handles the conversion from YAML
        # scalar values to Python the dictionary format
        config = yaml.load(file, Loader=yaml.FullLoader)
        return config


def extract_tokens(regexRules, text):
    all_tokens = list()
    tokens = apply_regex_rules(text, regexRules)
    for t in tokens:
        all_tokens.append(t)
    return all_tokens


def apply_regex_rules(text, regexRules):
    all_tokens = list()
    if text is not None:
        for rule in regexRules:
            text = text.lower()
            tokens = [x.group() for x in re.finditer(rule, text)]
            for t in tokens:
                all_tokens.append(t)
    return all_tokens


def apply_length_rules(tokens, min_length, max_length):
    all_tokens = list()
    for token in tokens:
        if token[-1] == "." and min_length < token.__len__() < max_length:
            token = token[0: -1]
            if not token.__contains__('.') and token.__len__() < 4:
                all_tokens.append(token)
            elif token.__contains__('.'):
                all_tokens.append(token)

    return all_tokens
