from .models import Assessment
import google.generativeai as genai
from django.conf import settings
import json

def generate_ai_quiz(topic, difficulty):
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    prompt = f"""
    Create a 10-question quiz about {topic} at {difficulty} level.
    Format as JSON with:
    - question
    - options (4 choices)
    - correct_answer
    - explanation
   Return STRICT JSON with this EXACT structure:
{{
  "title": "Quiz Title",
  "description": "Quiz description",
  "questions": [
    {{
      "question": "Question text?",
      "options": ["Option 1", "Option 2", ...],
      "correct_answer": "Correct Option",
      "explanation": "Explanation for correct answer"
    }}
  ]
}}
    """
    
    response = model.generate_content(prompt)
    try:
        # Remove markdown formatting if present
        response_text = response.text.strip().replace('```json', '').replace('```', '')
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON response from AI: {response_text}") from e