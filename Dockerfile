FROM php:8.2-cli

RUN docker-php-ext-install mysqli
WORKDIR /var/www/html
