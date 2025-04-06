from django.urls import path
from .views import (
    AssessmentSubmissionView, 
    GenerateQuizView, 
    complete_assessment, 
    get_learning_path, 
    complete_learning_node
)

urlpatterns = [
    path('quiz/', GenerateQuizView.as_view(), name='quiz'),
    path('submit/', AssessmentSubmissionView.as_view(), name='assessment-submit'),
    path('learning-path/', get_learning_path, name='learning-path'),
    path('complete-assessment/<int:attempt_id>/', complete_assessment, name='complete-assessment'),
    path('complete-learning-node/<int:node_id>/', complete_learning_node, name='complete-learning-node'),
]