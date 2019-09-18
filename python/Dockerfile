#FROM nvidia/cuda:latest 
FROM python:3.6-slim
RUN apt update
COPY requirements.txt requirements.txt
RUN apt -y  install python-pkg-resources
RUN pip3 install -r requirements.txt

