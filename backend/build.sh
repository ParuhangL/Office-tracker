#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
echo "from django.contrib.auth.models import User; User.objects.create_superuser('Admin', '', 'Angdembe4321')" | python manage.py shell