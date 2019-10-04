from mongoengine import *
import os

mongo_ip = 'mongo_ip'
default_value = 'localhost'
mongo_server = os.environ.get(mongo_ip, default_value)


def connectmongo():
    connect('preprocessing', host=mongo_server, port=27017)
