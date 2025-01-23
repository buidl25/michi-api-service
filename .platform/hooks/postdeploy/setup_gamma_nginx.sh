#!/bin/bash

# Fetch ENV and SERVICE environment variable
env_value=$(/opt/elasticbeanstalk/bin/get-config environment -k ENV)
service_value=$(/opt/elasticbeanstalk/bin/get-config environment -k SERVICE)

# Check if ENV equals 'gamma' and SERVICE equals 'api'
if [ "$env_value" != "gamma" ] || [ "$service_value" != "api" ]; then
    echo "Not in 'api gamma', skipping nginx setup."
    exit 0
fi
    
cat > /etc/nginx/conf.d/ssl_gamma.conf << LIMIT_STRING
server {
    listen        443 ssl;
    server_name   api.gamma.michiwallet.com;
    ssl_certificate      /etc/letsencrypt/live/api.gamma.michiwallet.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/api.gamma.michiwallet.com/privkey.pem;

    access_log    /var/log/nginx/access.log main;

    client_header_timeout 60;
    client_body_timeout   60;
    keepalive_timeout     60;
    gzip                  off;
    gzip_comp_level       4;
    gzip_types text/plain text/css application/json application/javascript application/x-javascript text/xml application/xml application/xml+rss text/javascript;

    # Include the Elastic Beanstalk generated locations
    include conf.d/elasticbeanstalk/*.conf;
}
LIMIT_STRING
    
service nginx restart