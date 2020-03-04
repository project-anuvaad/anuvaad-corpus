FROM node:10-alpine
COPY / /app
WORKDIR /app
RUN apk add poppler-utils
RUN npm install
CMD node app.js
#EXPOSE 8081
