from __future__ import unicode_literals, print_function

import plac
import random
from pathlib import Path
import spacy
from spacy.util import minibatch, compounding
from ast import literal_eval

# @plac.annotations(
#     model_dir=("Model directory",                   "option", "m", Path),
#     model_name=("Model name",                       "option", "n", str),
#     test_text=("text to annotated text",            "option", "text", str)
# )
def main(model_dir, test_text):
    # test_text = " REPORTABLE IN THE SUPREME COURT OF INDIA CIVIL APPELLATE JURISDICTION Civil Appeal No 9183 of 2019 (Arising out of Special Leave Petition (C) No 2035 of 2019) Meena Sharma	.... Appellant(s) Versus State of Jammu and Kashmir & Ors	....Respondent(s)"
    
    if model_dir is not None:
        print("Loading from", model_dir)
        nlp = spacy.load(model_dir)

        # assert nlp.get_pipe("ner").move_names == move_names
        doc = nlp(test_text)
        result_ner = list()
        for ent in doc.ents:
            annotation_json={
                "annotation_tag" : ent.label_,
                "tagged_value" : ent.text
            }
            result_ner.append(annotation_json)
        print("source result",result_ner)
        return result_ner
    else:
        return "invalid model path"
def api_call(model_dir, text):
    test_text = text
    model_dir = model_dir
    return main(model_dir,test_text)    
