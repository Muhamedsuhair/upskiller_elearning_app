from rest_framework.views import APIView
from rest_framework.response import Response
from google import generativeai as genai
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from rest_framework import status, permissions

class ProjectAssistanceView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        domain = request.data.get('domain')
        project_idea = request.data.get('project_idea')
        
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""
        Create a project plan for: {project_idea} in {domain}.
        Include:
        1. Key objectives
        2. Required technologies
        3. Step-by-step plan
        4. Recommended learning resources
        5. Collaboration opportunities
        Format as markdown.
        """
        
        response = model.generate_content(prompt)
        return Response({'project_plan': response.text}, status=200)