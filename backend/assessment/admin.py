# assessment/admin.py
from django.contrib import admin
from .models import (
    Assessment,
    Question,
    Option,
    AssessmentAttempt,
    UserResponse,
    Concept,
    QuestionConceptMapping,
    UserConceptProficiency,
    LearningPath,
    LearningPathNode,
)

class OptionInline(admin.TabularInline):
    """Inline for managing Options within a Question."""
    model = Option
    extra = 1  # Number of empty option forms to display

class QuestionConceptMappingInline(admin.TabularInline):
    """Inline for managing QuestionConceptMapping within a Question."""
    model = QuestionConceptMapping
    extra = 1

class LearningPathNodeInline(admin.TabularInline):
    """Inline for managing LearningPathNode within a LearningPath."""
    model = LearningPathNode
    extra = 1

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
    inlines = [OptionInline, QuestionConceptMappingInline]  # Add inline for managing options and concept mappings

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

@admin.register(Concept)
class ConceptAdmin(admin.ModelAdmin):
    """Admin configuration for the Concept model."""
    list_display = ('name', 'difficulty_level','description')
    list_filter = ('difficulty_level',)
    search_fields = ('name', 'description')
    filter_horizontal = ('prerequisites',)

@admin.register(QuestionConceptMapping)
class QuestionConceptMappingAdmin(admin.ModelAdmin):
    """Admin configuration for the QuestionConceptMapping model."""
    list_display = ('question', 'concept', 'weight')
    list_filter = ('concept', 'question__assessment')
    search_fields = ('question__text', 'concept__name')

@admin.register(UserConceptProficiency)
class UserConceptProficiencyAdmin(admin.ModelAdmin):
    """Admin configuration for the UserConceptProficiency model."""
    list_display = ('user', 'concept', 'proficiency_score', 'last_assessed')
    list_filter = ('concept', 'user')
    search_fields = ('user__username', 'concept__name')
    readonly_fields = ('last_assessed',)

@admin.register(LearningPath)
class LearningPathAdmin(admin.ModelAdmin):
    """Admin configuration for the LearningPath model."""
    list_display = ('title', 'user', 'created_at', 'updated_at', 'is_active','course_content_id')
    list_filter = ('is_active', 'user')
    search_fields = ('title', 'description', 'user__username')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [LearningPathNodeInline]

@admin.register(LearningPathNode)
class LearningPathNodeAdmin(admin.ModelAdmin):
    """Admin configuration for the LearningPathNode model."""
    list_display = ('learning_path', 'concept', 'order', 'content_type', 'completed')
    list_filter = ('content_type', 'completed', 'learning_path__user')
    search_fields = ('learning_path__title', 'concept__name')
    ordering = ('learning_path', 'order')