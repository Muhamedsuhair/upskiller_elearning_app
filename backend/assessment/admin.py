# assessment/admin.py
from django.contrib import admin
from .models import (
    Assessment,
    Question,
    Option,
    AssessmentAttempt,
    UserResponse,
)

class OptionInline(admin.TabularInline):
    """Inline for managing Options within a Question."""
    model = Option
    extra = 1  # Number of empty option forms to display

@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    """Admin configuration for the Assessment model."""
    list_display = ('id','title', 'created_by', 'passing_score', 'time_limit', 'created_at')
    list_filter = ('created_by', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at',)

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin configuration for the Question model."""
    list_display = ('text', 'assessment')
    list_filter = ('assessment',)
    search_fields = ('text',)
    inlines = [OptionInline]  # Add inline for managing options

@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    """Admin configuration for the Option model."""
    list_display = ('text', 'question', 'is_correct')
    list_filter = ('is_correct', 'question__assessment')
    search_fields = ('text',)

@admin.register(AssessmentAttempt)
class AssessmentAttemptAdmin(admin.ModelAdmin):
    """Admin configuration for the AssessmentAttempt model."""
    list_display = ('user', 'assessment', 'score', 'started_at', 'completed_at', 'passed')
    list_filter = ('passed', 'assessment', 'user')
    search_fields = ('user__username', 'assessment__title')
    readonly_fields = ('started_at', 'completed_at')

@admin.register(UserResponse)
class UserResponseAdmin(admin.ModelAdmin):
    """Admin configuration for the UserResponse model."""
    list_display = ('attempt', 'question', 'selected_option', 'is_correct', 'points_awarded')
    list_filter = ('is_correct', 'attempt__assessment', 'attempt__user')
    search_fields = ('question__text', 'selected_option__text')
    readonly_fields = ('points_awarded',)