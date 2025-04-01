from django.db import models
from django.contrib.auth.models import User

class CourseContent(models.Model):
    learning_style = models.CharField(max_length=50)
    topic = models.CharField(max_length=255)
    difficulty_level = models.CharField(max_length=50)
    content = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)