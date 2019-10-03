#!/bin/bash
cd node
commit_id=$(git rev-parse --short HEAD)
echo $commit_id> commit_id.txt
docker build -t gohila/$image_name:$commit_id .
docker login -u $dockerhub_user -p $dockerhub_pass
docker push gohila/$image_name:$commit_id

