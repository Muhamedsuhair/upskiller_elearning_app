from django.urls import path
from .views import AssessmentSubmissionView, GenerateQuizView

urlpatterns = [
    path('quiz/', GenerateQuizView.as_view(), name='quiz'),
    path('submit/', AssessmentSubmissionView.as_view(), name='assessment-submit'),
]