from django.db import migrations

def set_created_by(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Assessment = apps.get_model('assessment', 'Assessment')
    default_user = User.objects.first()  # Or a specific user
    if default_user:
        Assessment.objects.all().update(created_by=default_user)

class Migration(migrations.Migration):
    dependencies = [('assessment', '0002_remove_assessment_module_and_more')]
    operations = [migrations.RunPython(set_created_by)]