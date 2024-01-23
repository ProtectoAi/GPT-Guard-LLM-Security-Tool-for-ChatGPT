FROM node:20-alpine AS frontend  
RUN mkdir -p /home/node/app/node_modules && chown -R root:root /home/node/app

#ARG BACKEND_URL=http://localhost:3000
#ARG VITE_IS_DB_AVAILABLE=True
#ARG VITE_BACKEND_URL=http://localhost:7000/chat

# Specify all the ARGs you'll provide during build
ARG VITE_IS_DB_AVAILABLE
ARG VITE_BACKEND_URL
ARG VITE_MAX_FILE_SIZE_IN_KB

WORKDIR /home/node/app
COPY ./frontend/package*.json ./  
USER root
RUN npm ci  
COPY --chown=root:root ./frontend/ ./frontend
COPY --chown=root:root ./static/ ./static
WORKDIR /home/node/app/frontend
# Write the provided ARG values to the .env file
RUN echo "VITE_IS_DB_AVAILABLE=$VITE_IS_DB_AVAILABLE" >> /home/node/app/frontend/.env && \
    echo "VITE_MAX_FILE_SIZE_IN_KB=$VITE_MAX_FILE_SIZE_IN_KB" >> /home/node/app/frontend/.env && \
    echo "VITE_BACKEND_URL=$VITE_BACKEND_URL" >> /home/node/app/frontend/.env
RUN npm run build
  
FROM python:3.11-alpine 
RUN apk add --no-cache --virtual .build-deps \  
    build-base \  
    libffi-dev \  
    openssl-dev \  
    curl \  
    && apk add --no-cache \  
    libpq \  
    && pip install --no-cache-dir uwsgi  
RUN apk add postgresql-dev
ENV PATH="/path/to/postgresql/bin:${PATH}"

COPY requirements.txt /usr/src/app/  
RUN pip install --no-cache-dir -r /usr/src/app/requirements.txt \  
    && rm -rf /root/.cache  

# Create a directory to copy static files
# RUN mkdir -p /usr/src/app/static

COPY . /usr/src/app/  
COPY --from=frontend /home/node/app/static  /usr/src/app/static/
WORKDIR /usr/src/app  
EXPOSE 80  
CMD ["uwsgi", "--http", ":80", "--wsgi-file", "app.py", "--callable", "app", "-b","32768","--workers","4","--processes", "4","--http-timeout","60","--worker-reload-mercy", "120"]  
