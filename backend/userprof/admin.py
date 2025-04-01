# admin.py
from django.contrib import admin
from .models import UserProfile, CourseContent, ProgressRecord, DiagramPrompt, Certificate


class ProgressRecordInline(admin.TabularInline):
    model = ProgressRecord
    extra = 0


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'learning_style', 'date_joined', 'last_active')
    search_fields = ('user__username', 'user__email')
    list_filter = ('learning_style',)
    inlines = [ProgressRecordInline]


@admin.register(CourseContent)
class CourseContentAdmin(admin.ModelAdmin):
    list_display = ('title', 'content_type', 'difficulty_level', 'created_by', 'created_at', 'has_diagrams')
    list_filter = ('content_type', 'difficulty_level', 'has_diagrams')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at',)


@admin.register(ProgressRecord)
class ProgressRecordAdmin(admin.ModelAdmin):
    list_display = ('user_profile', 'content', 'status', 'completion_percentage', 'last_accessed')
    list_filter = ('status',)
    search_fields = ('user_profile__user__username', 'content__title')


@admin.register(DiagramPrompt)
class DiagramPromptAdmin(admin.ModelAdmin):
    list_display = ('course_content', 'diagram_type', 'prompt_text')
    list_filter = ('diagram_type',)
    search_fields = ('prompt_text', 'mermaid_code')
    raw_id_fields = ('course_content',)

@admin.register(Certificate)
class Certificate(admin.ModelAdmin):
    list_display = ('user', 'title', 'course_title', 'completion_date', 'score', 'total_questions', 'created_at')
    list_filter = ('completion_date', 'created_at', 'score')
    search_fields = ('user__username', 'title', 'course_title')
    readonly_fields = ('created_at', 'updated_at')
