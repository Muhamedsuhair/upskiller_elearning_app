# assessment/serializers.py
from rest_framework import serializers
from .models import (
    Assessment, Question, Option, AssessmentAttempt,
    UserResponse, Concept, QuestionConceptMapping,
    LearningPath, LearningPathNode, UserConceptProficiency
)

class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']

class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)
    concepts = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ['id', 'text', 'options', 'concepts']

    def get_concepts(self, obj):
        mappings = QuestionConceptMapping.objects.filter(question=obj)
        return [{
            'id': mapping.concept.id,
            'name': mapping.concept.name,
            'weight': mapping.weight
        } for mapping in mappings]

class AssessmentSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Assessment
        fields = ['id', 'title', 'description', 'questions']

class UserResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserResponse
        fields = ['id', 'question', 'selected_option', 'is_correct']

class AssessmentAttemptSerializer(serializers.ModelSerializer):
    responses = UserResponseSerializer(many=True, read_only=True)

    class Meta:
        model = AssessmentAttempt
        fields = ['id', 'assessment', 'started_at', 'completed_at', 'responses']

class ConceptSerializer(serializers.ModelSerializer):
    prerequisites = serializers.SerializerMethodField()

    class Meta:
        model = Concept
        fields = ['id', 'name', 'description', 'difficulty_level', 'prerequisites']

    def get_prerequisites(self, obj):
        return [{
            'id': prereq.id,
            'name': prereq.name
        } for prereq in obj.prerequisites.all()]

class UserConceptProficiencySerializer(serializers.ModelSerializer):
    concept = ConceptSerializer(read_only=True)

    class Meta:
        model = UserConceptProficiency
        fields = ['id', 'concept', 'proficiency_score']

class LearningPathNodeSerializer(serializers.ModelSerializer):
    concept = ConceptSerializer(read_only=True)
    content = serializers.SerializerMethodField()

    class Meta:
        model = LearningPathNode
        fields = ['id', 'concept', 'order', 'content_type', 'content_id', 'completed', 'content']

    def get_content(self, obj):
        # This would typically fetch the actual content from your content storage
        # For now, we'll return a placeholder
        return {
            'title': obj.concept.name,
            'description': obj.concept.description,
            'type': obj.content_type,
            'id': obj.content_id
        }

class LearningPathSerializer(serializers.ModelSerializer):
    nodes = LearningPathNodeSerializer(many=True, read_only=True)

    class Meta:
        model = LearningPath
        fields = ['id', 'title', 'description', 'nodes']

class SubmissionSerializer(serializers.Serializer):
    assessment_id = serializers.IntegerField()
    answers = serializers.ListField(
        child=serializers.DictField(
            child=serializers.IntegerField()
        )
    )
