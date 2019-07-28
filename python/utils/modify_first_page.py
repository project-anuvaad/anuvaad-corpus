from models.lookup import Lookup
import requests
import json

lookup_data_string = '{"reportable":  "परिव्यापक","in the supreme court of india civil original jurisdiction" : "भारत के उच्चतम न्यायालय में सिविल अधिकारिताएं","in the supreme court of india criminal/civil original jurisdiction": "भारत के उच्चतम न्यायालय में दांडिक/सिविल अधिकारिताएं","in the supreme court of india criminal original jurisdiction": "भारत के उच्चतम न्यायालय में दांडिक अधिकारिताएं","union of india" : "भारतीय संघ","petitioner" : "याचिकाकर्ता","with": "साथ में","shreya singhal" : "श्रेया सिंघल","versus" : "बनाम","respondent" : "उत्तरदाता","judgment": "निर्णय","... respondent"  : "उत्तरदाता","writ petition (criminal)": "रिट याचिका (आपराधिक) सं.","civil appeal" : "सिविल अपील सं.","writ petition (civil)" : "रिट याचिका (सिविल) सं.","contempt petition(civil)" : "संपर्क याचिका (सिविल) सं.","special leave petition(criminal)": "विशेष अवकाश याचिका (अपराधी) सं.","in": "मे","a.k. sikri,j" : "ए.के. सिकरि, जे","transferred petition (civil)" : "स्थानांतरित याचिका सं.","civil appellate jurisdiction" : "सिविल अपील न्यायिक क्षेत्र"}'  

def update_lookup_data():
    
    lookup_data = json.loads(lookup_data_string)
    return (lookup_data)
     

def modify_text_on_first_page(nodes):
   update_lookup_data()
  
   if not nodes == None:
        for node in nodes:
        
            if  not node.text.strip() =='':
                index = node.text.rfind(')')
                index_c_a_n = node.text.lower().find('civil appeal no')
                print ('text before lookup '+ node.text.lower())
                if not index == -1:
                    text = node.text
                    node.text = text[:index+1]
                    numeric_text = text[index+1:]
                    numeric_text_t = get_numeric_translation(numeric_text)
                    node.text = get_from_lookup(node.text.lower().strip()) + numeric_text_t
                elif not index_c_a_n == -1:
                    text = node.text.lower()
                    index_no = text.find('l no')
                    
                    index_dot =  text.find('.')
                    node.text = text[:index_no + 1]
                    numeric_text =  text[index_dot + 1:]
                    numeric_text_t = get_numeric_translation(numeric_text)
                    node.text = get_from_lookup(node.text.lower().strip()) + numeric_text_t
                    
                else :
                    node.text = get_from_lookup(node.text)
                print('text after lookup '+node.text)


def get_numeric_translation(text):
    index_f = text.lower().rfind('f')
    year = ''
    if not index_f == -1:
        year = text[index_f+1:]
    index_dot = text.find('.') 
    index_of = text.lower().rfind('of')
    number = text [index_dot+1:-(index_of-1)]
    r_index_of = number.lower().rfind('o')
    if not r_index_of == -1:
        number = number[:-1]
    return number + '/' + year


def call_translate(text_):
    try :       
                arr = []
                print(text_)
                arr.append({'src': text_, 'id': 1,'s_id':'1'})
                res = requests.post('http://18.236.30.130:3003/translator/translation_en', json=arr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    print('modify_first_page:call_translate : ') 
                    print( dictFromServer['response_body'])
                    for translation in dictFromServer['response_body']:
                        try : 
                            # print('docx_translate_helper:modify_text : recieved translating from server : ') 
                            print(translation)
                            return (translation['tgt'])
                        except:
                            print("modify_first_page:call_translate : ERROR : while adding to the results list")
                            return None    
                
    except: 
                print('modify_first_page:call_translate : ERROR : while getting data from translating server for less than 25 batch size ')

def get_from_lookup(text_):
    lookup_data = update_lookup_data()
    
    try :
        print("modify_first_page:get_from_lookup : data is "+ lookup_data[text_.strip().lower()])
        lookup =  lookup_data[text_.strip().lower()]
    except :
        lookup = None
        pass
    # lookup = Lookup.objects(text = text_.strip().lower())
    try :
        if not lookup == None :
            
            return lookup
        if lookup == None :
            return call_translate(text_)
    except :
        return call_translate(text_)



def get_first_page_nodes(nodes):
    i = True
    first_page = []

    for node in nodes:
        first_page.append(node)
        if i == False :
            return first_page
        print("modify_first_page:get_first_page_nodes: text == " + node.text )
        if not (node.text.strip()) == '':
            if node.text.strip().lower() == 'judgment' or node.text.strip().lower() == 'j u d g m e n t':
                print()
                i  = False
    
    return None

def get_nodes_after_f_page(nodes, fpage_len):
    print("modify_first_page:get_nodes_after_f_page: started")
    node_list = []
    i = 0
    for node in nodes :
        if i >= fpage_len:
            node_list.append(node)
        i = i +1
    return node_list

def get_size(nodes):
    i =0 
    if nodes == None:
        return i
    for node in nodes :
        i = i+1
    return i
