from django.urls import path, include
from .views import GenerateContentView
import assessment.urls

urlpatterns = [
    path('generate-content/', GenerateContentView.as_view(), name='generate-content'),
    path('',include(assessment.urls))

]
