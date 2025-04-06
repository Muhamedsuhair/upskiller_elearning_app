import google.generativeai as genai
from django.conf import settings
import json
import logging

logger = logging.getLogger(__name__)

class ConceptExtractionService:
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    def extract_concepts_from_question(self, question_text):
        """Extract key educational concepts from a question using Gemini AI."""
        prompt = f"""Analyze the following question and identify the key educational concepts being tested.
        Return the response in the following JSON format:
        {{
            "concepts": [
                {{
                    "name": "concept name",
                    "description": "brief description of the concept",
                    "difficulty_level": "beginner/intermediate/expert",
                    "prerequisites": ["prerequisite concept 1", "prerequisite concept 2"]
                }}
            ]
        }}

        Question: {question_text}
        """
        
        try:
            response = self.model.generate_content(prompt)
            print(response)
            try:
                result = json.loads(response.text)
                return result.get('concepts', [])
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini response: {str(e)}")
                logger.error(f"Raw response: {response.text}")
                return []
        except Exception as e:
            logger.error(f"Error in concept extraction: {str(e)}")
            return []

    def analyze_assessment_results(self, incorrect_responses):
        """
        Analyze assessment results to identify weak concepts and generate recommendations.
        """
        try:
            # Prepare the prompt for Gemini
            prompt = f"""
            Analyze these incorrect assessment responses and identify the weak concepts.
            For each weak concept, provide:
            1. The concept name
            2. Proficiency level (low, medium, high)
            3. Specific recommendations for improvement

            Incorrect Responses:
            {json.dumps(incorrect_responses, indent=2)}

            Return the analysis in this JSON format:
            {{
                "weak_concepts": [
                    {{
                        "concept": "concept name",
                        "proficiency_level": "low/medium/high",
                        "recommendations": [
                            "recommendation 1",
                            "recommendation 2",
                            "recommendation 3"
                        ]
                    }}
                ],
                "learning_path_order": [
                    "concept 1",
                    "concept 2",
                    "concept 3"
                ]
            }}
            """

            # Get response from Gemini
            response = self.model.generate_content(prompt)
            print("response:", response)
            
            # Extract the text content from the response
            response_text = response.text
            
            # Remove markdown code block formatting if present
            if response_text.startswith('```json'):
                response_text = response_text[7:]  # Remove ```json
            if response_text.endswith('```'):
                response_text = response_text[:-3]  # Remove trailing ```
            
            # Clean up any leading/trailing whitespace
            response_text = response_text.strip()
            
            # Parse the JSON response
            try:
                analysis = json.loads(response_text)
                print("Parsed analysis:", analysis)
                return analysis
            except json.JSONDecodeError as e:
                print(f"Failed to parse Gemini response: {str(e)}")
                print("Raw response:", response_text)
                # Return a default analysis if parsing fails
                return {
                    "weak_concepts": [],
                    "learning_path_order": []
                }
            
        except Exception as e:
            print(f"Error analyzing assessment results: {str(e)}")
            return {
                "weak_concepts": [],
                "learning_path_order": []
            }

    def generate_learning_content(self, concept_name: str, concept_description: str, content_type: str, difficulty_level: str, prompt: str = None) -> str:
        """
        Generate learning content for a concept using Gemini AI.
        
        Args:
            concept_name: The name of the concept to generate content for
            concept_description: A description of the concept
            content_type: The type of content to generate ('video', 'text', or 'interactive')
            difficulty_level: The difficulty level of the content
            prompt: Optional custom prompt to use instead of the default prompts
        """
        try:
            # Use the custom prompt if provided, otherwise use the default prompts
            if prompt:
                # Use the provided prompt directly
                final_prompt = prompt
            else:
                # Prepare the prompt based on content type
                if content_type == 'video':
                    final_prompt = f"""
                    Create a video script for teaching the concept '{concept_name}'.
                    Concept description: {concept_description}
                    Difficulty level: {difficulty_level}
                    
                    The script should include:
                    1. Introduction to the concept
                    2. Main explanation with examples
                    3. Visual descriptions for key points
                    4. Summary and key takeaways
                    
                    Format the response as a JSON object with this structure:
                    {{
                        "sections": [
                            {{
                                "title": "section title",
                                "content": "section content",
                                "duration": "duration in seconds",
                                "visual_description": "description of visuals to show"
                            }}
                        ]
                    }}
                    """
                elif content_type == 'text':
                    final_prompt = f"""
                    Create comprehensive text content for teaching the concept '{concept_name}'.
                    Concept description: {concept_description}
                    Difficulty level: {difficulty_level}
                    
                    The content should include:
                    1. Introduction
                    2. Detailed explanation
                    3. Examples and applications
                    4. Practice questions
                    5. Summary
                    
                    Format the response in Markdown with proper headings and sections.
                    Use markdown formatting for:
                    - Headers (## for section headers)
                    - Lists (both ordered and unordered)
                    - Code blocks (if applicable)
                    - Tables (if applicable)
                    - Emphasis (bold and italic)
                    """
                else:  # interactive
                    final_prompt = f"""
                    Create an interactive learning experience for the concept '{concept_name}'.
                    Concept description: {concept_description}
                    Difficulty level: {difficulty_level}
                    
                    The content should include:
                    1. Interactive elements (simulations, exercises, etc.)
                    2. Step-by-step guidance
                    3. Immediate feedback mechanisms
                    4. Progress tracking
                    
                    Format the response as a JSON object with this structure:
                    {{
                        "type": "interactive",
                        "steps": [
                            {{
                                "title": "step title",
                                "content": "step content",
                                "interaction_type": "type of interaction",
                                "feedback": "feedback message"
                            }}
                        ],
                        "progress_tracking": {{
                            "total_steps": number,
                            "completion_criteria": "criteria for completion"
                        }}
                    }}
                    """
            
            # Generate content using Gemini
            response = self.model.generate_content(final_prompt)
            
            # Process and format the response
            content = response.text
            
            # Clean up the response
            content = content.strip()
            
            # For interactive content, ensure it's valid JSON
            if content_type == 'interactive':
                try:
                    # Remove any markdown code block formatting
                    if content.startswith('```json'):
                        content = content[7:]
                    if content.endswith('```'):
                        content = content[:-3]
                    content = content.strip()
                    
                    # Validate JSON structure
                    json.loads(content)
                except json.JSONDecodeError:
                    # If not valid JSON, wrap it in a basic structure
                    content = json.dumps({
                        'type': 'interactive',
                        'steps': [{'content': content}]
                    })
            
            return content
            
        except Exception as e:
            logger.error(f"Error generating learning content: {str(e)}")
            raise 