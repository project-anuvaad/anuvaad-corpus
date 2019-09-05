import time
import redis
import json

default_wait_time = 120
limit = 25
output_file = "corpus_hi.txt"
input_file = "corpus.txt"
target_lang = "hi"
redis_cli = redis.StrictRedis(host="localhost", port=6379, charset="utf-8", decode_responses=True)


def put_count(count):
    try:
        redis_cli.hset('corpus_creation', output_file, count)
    except Exception as e:
        print("ERROR WHILE WRITING TO REDIS")
        print(e)


def get_count():
    try:
        count = redis_cli.hget('corpus_creation', output_file)
        return count
    except Exception as e:
        print("ERROR WHILE READING FROM REDIS")
        print(e)
        return None

# {'name': 'Bengali', 'language': 'bn'},
# {'name': 'Gujarati', 'language': 'gu'},
# {'name': 'Hindi', 'language': 'hi'},
# {'name': 'Kannada', 'language': 'kn'},
# {'name': 'Marathi', 'language': 'mr'},
# {'name': 'Punjabi', 'language': 'pa'},
# {'name': 'Tamil', 'language': 'ta'},
# {'name': 'Telugu', 'language': 'te'}
# {'name': 'Malayalam', 'language': 'ml'}


def translate(sentences, target, factor):
    from google.cloud import translate
    try:
        translation_list = []
        translate_client = translate.Client()

        translations = translate_client.translate(
            sentences,
            target_language=target)
        print(translations)
        try:
            with open(output_file, 'a', encoding='utf-8') as target:
                for translation in translations:
                    translation_list.append(translation['translatedText'])
                    data = translation['translatedText']
                    target.write(data)
                    target.write('\n')
            target.close()
            return False
        except Exception as e:
            print("exception occurred while writing ")
            print(e)
            return True
    except Exception as e:
        print("exception occurred while translating")
        print(e)
        print("***************************************FAILURE**********************************************")
        print("waiting for some time before making same call")
        send_notification(sentences, e)
        time.sleep(default_wait_time * factor)
        return True


# translate(["this is good", "this is good", "this is good"], 'hi')


def read_file(filename, lang):
    EOF = False
    count = get_count()
    try:
        with open(filename, 'r', encoding='utf-8') as source:
            i = 0
            j = 0
            if count is not None:
                count = int(count)
                while j < count:
                    j = j + 1
                    source.readline()
            else:
                count = 0
            sentences = []

            while i < limit:
                i = i + 1
                sentence = source.readline()
                if sentence == '':
                    EOF = True
                    i = limit
                sentences.append(sentence)
                if i == limit:
                    failure = True
                    factor = 1
                    while failure:
                        failure = translate(sentences, lang, factor)
                        factor = factor + 1
                    count = count + limit - 1
                    put_count(count)
                    i = 0
                    sentences = []
                if EOF:
                    break
        source.close()
    except Exception as e:
        print(e)


def send_notification(sentences, error):
    import smtplib

    # creates SMTP session
    s = smtplib.SMTP('smtp.gmail.com', 587)
    s.ehlo()
    # start TLS for security
    s.starttls()

    # Authentication
    s.login("error.notification.py@gmail.com", 'erroroccurred123')

    # message to be sent
    message = "ERROR OCCURRED FOR SENTENCES = " + json.dumps(sentences)
    message = message + "\nERROR IS == " + json.dumps(error)

    # sending the mail
    s.sendmail("error.notification.py@gmail.com", "mayank.morya@tarento.com,moryamayank9@gmail.com", message)

    # terminating the session
    s.quit()


read_file(input_file, target_lang)

# a = ['a', 'n']
# send_notification(a)

