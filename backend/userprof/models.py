from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

class Course(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    enrolled_users = models.ManyToManyField(
        User, 
        through='Enrollment',
        related_name='enrolled_courses'
    )


class CourseContent(models.Model):
    """Model representing course content items that users can track progress on"""
    
    DIFFICULTY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    content_type = models.CharField(max_length=50, choices=[
        ('video', 'Video'),
        ('article', 'Article'),
        ('quiz', 'Quiz'),
        ('exercise', 'Exercise'),
    ])
    difficulty_level = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='beginner'
    )
    duration_minutes = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='authored_content'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    has_diagrams = models.BooleanField(default=False)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['difficulty_level', 'title']

class Enrollment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    enrolled_at = models.DateTimeField(auto_now_add=True)

class UserProfile(models.Model):
    """Model representing extended user profile with learning preferences and progress tracking"""
    LEARNING_STYLE_CHOICES = [
        ('visual', 'Visual'),
        ('auditory', 'Auditory'),
        ('kinesthetic', 'Kinesthetic'),
    ]
    
    DIFFICULTY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('expert', 'Expert'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    learning_style = models.CharField(
        max_length=20,
        choices=LEARNING_STYLE_CHOICES,
        default='visual'
    )
    difficulty_level = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='beginner'
    )
    bio = models.TextField(blank=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)
    
    course_content = models.ManyToManyField(
        CourseContent,
        through='ProgressRecord',
        related_name='enrolled_users'
    )
    
    def __str__(self):
        return f"{self.user.username}'s Profile"
    
    def determine_next_difficulty(self):
        """Determine appropriate content difficulty based on recent progress"""
        recent_progress = self.progress_records.filter(
            status='completed',
            last_accessed__gte=timezone.now() - timedelta(days=7)
        ).order_by('-last_accessed')[:3]
        
        if not recent_progress:
            return 'beginner'
        
        total = sum(p.completion_percentage for p in recent_progress)
        avg_completion = total / len(recent_progress)
        
        if avg_completion >= 85:
            return 'advanced'
        elif avg_completion >= 65:
            return 'intermediate'
        else:
            return 'beginner'
    
    def update_progress(self, content, status, completion_percentage=0):
        """
        Update progress for a specific course content
        
        Args:
            content: CourseContent instance
            status: Progress status (not_started/in_progress/completed)
            completion_percentage: Percentage completed (0-100)
        
        Returns:
            ProgressRecord instance
        """
        progress, created = ProgressRecord.objects.get_or_create(
            user_profile=self,
            content=content,
            defaults={
                'status': status,
                'completion_percentage': completion_percentage
            }
        )
        
        if not created:
            progress.status = status
            progress.completion_percentage = completion_percentage
            progress.save()
            
        return progress
    
    def get_progress_summary(self):
        """
        Get summary of user's progress across all content
        
        Returns:
            Dictionary with progress statistics
        """
        all_records = self.progress_records.all()
        completed = all_records.filter(status='completed').count()
        in_progress = all_records.filter(status='in_progress').count()
        not_started = all_records.filter(status='not_started').count()
        
        total_content = all_records.count()
        completion_rate = (completed / total_content * 100) if total_content > 0 else 0
        
        return {
            'completed': completed,
            'in_progress': in_progress,
            'not_started': not_started,
            'total_content': total_content,
            'completion_rate': round(completion_rate, 2)
        }


class ProgressRecord(models.Model):
    """Model representing a user's progress on specific course content"""
    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    
    user_profile = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name='progress_records'
    )
    content = models.ForeignKey(
        CourseContent,
        on_delete=models.CASCADE,
        related_name='progress_records'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='not_started'
    )
    completion_percentage = models.PositiveIntegerField(default=0)
    last_accessed = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['user_profile', 'content']
        ordering = ['-last_accessed']
        
    def __str__(self):
        return f"{self.user_profile.user.username}'s progress on {self.content.title}"

    def update_percentage(self, new_percentage):
        """Update completion percentage and automatically update status if needed"""
        self.completion_percentage = min(new_percentage, 100)
        
        if self.completion_percentage == 100:
            self.status = 'completed'
        elif self.completion_percentage > 0:
            self.status = 'in_progress'
        else:
            self.status = 'not_started'
            
        self.save()
        return self
class DiagramPrompt(models.Model):
    course_content = models.ForeignKey(
        CourseContent,
        on_delete=models.CASCADE,
        related_name='diagrams'
    )
    prompt_text = models.TextField()
    mermaid_code = models.TextField()
    diagram_type = models.CharField(
        max_length=20,
        choices=[('image', 'Image'), ('mermaid', 'Mermaid')],
        default='mermaid'
    )
    created_at = models.DateTimeField(auto_now_add=True)

class Certificate(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='certificates')
    title = models.CharField(max_length=255)
    course_title = models.CharField(max_length=255)
    completion_date = models.DateTimeField()
    score = models.IntegerField()
    total_questions = models.IntegerField()
    certificate_data = models.TextField()  # Store base64 encoded PNG data
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-completion_date']

    def __str__(self):
        return f"{self.user.username}'s Certificate for {self.course_title}"    