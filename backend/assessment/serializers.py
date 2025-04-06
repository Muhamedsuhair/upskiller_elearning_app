# assessment/serializers.py
from rest_framework import serializers
from .models import (
    AssessmentAttempt, UserResponse, Assessment, Question, Option,
    Concept, QuestionConceptMapping, UserConceptProficiency, LearningPath, LearningPathNode
)

class UserResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserResponse
        fields = ['question', 'selected_option', 'response_text', 'is_correct', 'points_awarded']

class AssessmentSubmissionSerializer(serializers.Serializer):
    assessment = serializers.PrimaryKeyRelatedField(queryset=Assessment.objects.all())
    processed_answers = UserResponseSerializer(many=True)

class SubmissionSerializer(serializers.Serializer):
    assessment_id = serializers.IntegerField(required=True)
    answers = serializers.ListField(
        child=serializers.DictField(
            child=serializers.IntegerField(),
            required=True
        ),
        required=True
    )
class AnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(required=True)
    selected_option_id = serializers.IntegerField(required=True)

# Learning Path Serializers
class ConceptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Concept
        fields = ['id', 'name', 'description', 'difficulty_level']

class QuestionConceptMappingSerializer(serializers.ModelSerializer):
    concept = ConceptSerializer(read_only=True)
    
    class Meta:
        model = QuestionConceptMapping
        fields = ['id', 'question', 'concept', 'weight']

class UserConceptProficiencySerializer(serializers.ModelSerializer):
    concept = ConceptSerializer(read_only=True)
    
    class Meta:
        model = UserConceptProficiency
        fields = ['id', 'user', 'concept', 'proficiency_score', 'last_assessed']

class LearningPathNodeSerializer(serializers.ModelSerializer):
    concept = ConceptSerializer(read_only=True)
    
    class Meta:
        model = LearningPathNode
        fields = ['id', 'learning_path', 'concept', 'order', 'content_type', 'content_id', 'completed']

class LearningPathSerializer(serializers.ModelSerializer):
    nodes = LearningPathNodeSerializer(many=True, read_only=True)
    course_content = serializers.SerializerMethodField()

    class Meta:
        model = LearningPath
        fields = ['id', 'user', 'title', 'description', 'created_at', 'updated_at', 'is_active', 'nodes', 'course_content']

    def get_course_content(self, obj):
        if obj.course_content_id and obj.course_content_title:
            return {
                'id': obj.course_content_id,
                'title': obj.course_content_title
            }
        return None
