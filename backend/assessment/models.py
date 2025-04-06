# assessment/models.py
from django.db import models
from django.contrib.auth.models import User

class Assessment(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    passing_score = models.PositiveIntegerField()
    time_limit = models.PositiveIntegerField(default=30,help_text="Time in minutes")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class Question(models.Model):
    assessment = models.ForeignKey(Assessment, related_name='questions', on_delete=models.CASCADE)
    text = models.TextField()

class Option(models.Model):  # This is the correct model name
    question = models.ForeignKey(Question, related_name='options', on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

class AssessmentAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    score = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField()
    passed = models.BooleanField(default=False)

class UserResponse(models.Model):
    attempt = models.ForeignKey(AssessmentAttempt, related_name='responses', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(Option, null=True, on_delete=models.SET_NULL)
    response_text = models.TextField(blank=True)
    is_correct = models.BooleanField(default=False)
    points_awarded = models.PositiveIntegerField(default=0)

class Concept(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    difficulty_level = models.CharField(max_length=20, choices=[
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('expert', 'Expert')
    ])
    prerequisites = models.ManyToManyField('self', symmetrical=False, blank=True)
    
    def __str__(self):
        return self.name

class QuestionConceptMapping(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    concept = models.ForeignKey(Concept, on_delete=models.CASCADE)
    weight = models.FloatField(default=1.0)  # How strongly this question tests the concept
    
    class Meta:
        unique_together = ('question', 'concept')

class UserConceptProficiency(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    concept = models.ForeignKey(Concept, on_delete=models.CASCADE)
    proficiency_score = models.FloatField(default=0.0)  # 0.0 to 1.0
    last_assessed = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('user', 'concept')

class LearningPath(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='learning_paths')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    course_content_id = models.IntegerField(null=True, blank=True)
    course_content_title = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.title} - {self.user.username}"

class LearningPathNode(models.Model):
    learning_path = models.ForeignKey(LearningPath, related_name='nodes', on_delete=models.CASCADE)
    concept = models.ForeignKey(Concept, on_delete=models.CASCADE)
    order = models.PositiveIntegerField()
    content_type = models.CharField(max_length=20, choices=[
        ('video', 'Video'),
        ('text', 'Text'),
        ('interactive', 'Interactive'),
        ('assessment', 'Assessment')
    ])
    content_id = models.CharField(max_length=255)  # ID of the specific content
    completed = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['order']
        unique_together = ('learning_path', 'order')


