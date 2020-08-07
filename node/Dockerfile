FROM node:10-alpine
COPY / /app
WORKDIR /app
RUN apk add poppler-utils
RUN npm install
CMD node --max_old_space_size=1024 app.js
#EXPOSE 8081
