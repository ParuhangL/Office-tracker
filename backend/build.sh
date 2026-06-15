#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

echo "
from django.contrib.auth.models import User
u = User.objects.get(username='Admin')
u.set_password('password1234!')
u.save()
print('Password reset done')
" | python manage.py shell