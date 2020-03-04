# Anuvaad Toolkit: Anuvaad English Tokenizer extending nltk tokenizer
#
# Author: Aroop <aroop@tarento.com>
# URL: <http://developers.anuvaad.org/>

import re
from nltk.tokenize.punkt import PunktSentenceTokenizer, PunktParameters, PunktTrainer, PunktLanguageVars
from nltk.tokenize import sent_tokenize

"""
Utility class for first page tokenizer for anuvaad project
"""
class AnuvaadEngTokenizer(object):
    """
    Default abbrevations
    """
    _abbrevations_with_space = ['of ', 'NO. ','Pvt. ', 'NOS. ','Smt. ']
    _abbrevations_without_space = ['Crl.']
    _tokenizer = None
    _regex_search_texts = []
    
    def __init__(self, abbrevations=None):
        if abbrevations is not None:
            self._abbrevations_without_space.append(abbrevations)
        punkt_param = PunktParameters()
        with open('utils/tokenizer_data/starter.txt', encoding='utf8') as f:
            text = f.read()
        punkt_param.sent_starters = text.split('\n')
        self._regex_search_texts = []
        self._tokenizer = PunktSentenceTokenizer(train_text=punkt_param,lang_vars = BulletPointLangVars())

    def tokenize(self, text):
        print('--------------Process started-------------')
        text = self.serialize_pattern(text)
        text = self.serialize_with_abbrevations(text)
        text = self.serialize_dots(text)
        sentences = self._tokenizer.tokenize(text)
        output = []
        for se in sentences:
            se = self.deserialize_pattern(se)
            se = self.deserialize_dots(se)
            output.append(self.deserialize_with_abbrevations(se))
        print('--------------Process finished-------------')
        return output

    def serialize_dots(self, text):
        pattern = re.compile(r'([.]{3,})')
        text = pattern.sub('XX__XX', text)
        return text

    def deserialize_dots(self, text):
        pattern = re.compile(re.escape('XX__XX'), re.IGNORECASE)
        text = pattern.sub('......', text)
        return text
           
    def serialize_pattern(self, text):
        regexp = re.compile(r'^([a-zA-Z][.][a-zA-Z][.])$')
        text_array = text.split(' ')
        text_updated = ''
        index = 0
        for t in text_array:
            if regexp.search(t):
                text_updated = text_updated + ' '+ '$$'+str(index)+'$$'
                self._regex_search_texts.append(t)
                index += 1
            else:
                if text_updated == '':
                    text_updated = text_updated + t 
                else:
                    text_updated = text_updated +' '+ t 
        return text_updated

    def deserialize_pattern(self, text):
        index = 0
        for search_text in self._regex_search_texts:
            pattern = re.compile(re.escape('$$'+str(index)+'$$'), re.IGNORECASE)
            text = pattern.sub(search_text, text)
            index += 1
        return text
    
    def serialize_with_abbrevations(self, text):
        index = 0
        index_for_without_space = 0
        for abbrev in self._abbrevations_with_space:
            pattern = re.compile(re.escape(abbrev), re.IGNORECASE)
            text = pattern.sub('#'+str(index)+'# ', text)
            index += 1
        for abbrev in self._abbrevations_without_space:
            pattern = re.compile(re.escape(abbrev), re.IGNORECASE)
            text = pattern.sub('#'+str(index_for_without_space)+'##', text)
            index_for_without_space += 1
        return text

    def deserialize_with_abbrevations(self, text):
        index = 0
        index_for_without_space = 0
        for abbrev in self._abbrevations_with_space:
            pattern = re.compile(re.escape('#'+str(index)+'# '), re.IGNORECASE)
            text = pattern.sub(abbrev, text)
            index += 1
        for abbrev in self._abbrevations_without_space:
            pattern = re.compile(re.escape('#'+str(index_for_without_space)+'##'), re.IGNORECASE)
            text = pattern.sub(abbrev, text)
            index_for_without_space += 1
        return text


class BulletPointLangVars(PunktLanguageVars):
    text = []
    with open('utils/tokenizer_data/train.txt', encoding='utf8') as f:
        text = f.read()
    sent_end_chars = text.split('\n')
    
    # # punkt = PunktTrainer()
    # # punkt.train(text,finalize=False, verbose=False)
    # # punkt.finalize_training(verbose=True)
# text = ''
# with open('data5.txt', encoding='utf8') as f:
#     text = f.read()
# tokenizer = AnuvaadEngTokenizer()
# tokenizer.tokenize(text)
    