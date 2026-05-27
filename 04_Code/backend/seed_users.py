"""
seed_users.py — Creates demo users for DairyPro 360.
Run via: python manage.py shell < seed_users.py
"""
import django
django.setup()

from dairypro.core.models import User, Role

if not User.objects.filter(email='admin@dairypro.com').exists():
    User.objects.create_superuser(
        email='admin@dairypro.com',
        password='Admin@123',
        full_name='Super Admin',
        role=Role.SUPER_ADMIN,
    )
    print('[OK] Super admin created: admin@dairypro.com / Admin@123')

    demo_users = [
        ('manager@dairypro.com',     'Manager@123',  Role.FARM_MANAGER,  'Farm Manager'),
        ('accountant@dairypro.com',  'Account@123',  Role.ACCOUNTANT,    'Chief Accountant'),
        ('worker@dairypro.com',      'Worker@123',   Role.FIELD_WORKER,  'Field Worker'),
        ('vet@dairypro.com',         'Vet@123',      Role.VET,           'Dr. Singh (Vet)'),
        ('viewer@dairypro.com',      'Viewer@123',   Role.VIEWER,        'Read-Only Viewer'),
    ]
    for email, pwd, role, name in demo_users:
        User.objects.create_user(email=email, password=pwd, role=role, full_name=name)
        print(f'[OK] Created {role}: {email}')

    print()
    print('All demo users ready!')
else:
    print('[OK] Users already exist. Skipping.')
