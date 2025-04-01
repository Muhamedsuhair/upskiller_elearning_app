# assessment/serializers.py
from rest_framework import serializers
from .models import AssessmentAttempt, UserResponse, Assessment, Question, Option  # Change here

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
