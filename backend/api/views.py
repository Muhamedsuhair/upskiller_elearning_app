from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import UserRateThrottle
from rest_framework_simplejwt.authentication import JWTAuthentication
from userprof.models import CourseContent, DiagramPrompt, UserProfile
from .serializers import CourseContentSerializer
from django.conf import settings
from google import generativeai as genai
import re
import json

class GenerateContentThrottle(UserRateThrottle):
    rate = '5/min'

def generate_kinesthetic_elements(topic, difficulty):
    """Generate kinesthetic learning elements based on topic and difficulty."""
    elements = []
    
    # Code playground
    elements.append(f'''
<div class="kinesthetic-playground" data-playground='{{"language": "python", "initialCode": "# Write your {topic} code here\\n", "testCases": [{{"input": "example", "expected": "output"}}]}}'>
</div>
''')

    # Virtual lab simulation
    elements.append(f'''
<div class="virtual-lab" data-lab='{{"title": "Interactive {topic} Lab", "steps": [
    {{"instruction": "Step 1: Setup the environment", "action": "setup"}},
    {{"instruction": "Step 2: Explore {topic} concepts", "action": "explore"}},
    {{"instruction": "Step 3: Test your understanding", "action": "test"}}
]}}'>
</div>
''')

    # Interactive simulation
    elements.append(f'''
<div class="interactive-simulation" data-simulation='{{"type": "visualization", "topic": "{topic}", "difficulty": "{difficulty}", "interactive": true}}'>
</div>
''')

    # Drag and drop exercise
    elements.append(f'''
<div class="drag-drop-exercise" data-items='{{"items": [
    {{"id": "1", "content": "First concept", "category": "basic"}},
    {{"id": "2", "content": "Second concept", "category": "intermediate"}},
    {{"id": "3", "content": "Third concept", "category": "advanced"}}
], "zones": [
    {{"id": "zone1", "accepts": ["basic"]}},
    {{"id": "zone2", "accepts": ["intermediate"]}},
    {{"id": "zone3", "accepts": ["advanced"]}}
]}}'>
</div>
''')

    # Reveal steps
    elements.append(f'''
<div class="reveal-steps" data-steps='{{"steps": [
    {{"title": "Introduction to {topic}", "content": "Basic concepts and fundamentals"}},
    {{"title": "Intermediate {topic}", "content": "Advanced techniques and patterns"}},
    {{"title": "Expert {topic}", "content": "Best practices and optimization"}}
]}}'>
</div>
''')
    
    return '\n'.join(elements)

class GenerateContentView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [GenerateContentThrottle]

    def post(self, request):
        learning_style = request.data.get('learning_style')
        topic = request.data.get('topic')
        difficulty_level = request.data.get('difficulty_level')
        
        if not all([learning_style, topic, difficulty_level]):
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        style_instructions = {
            'visual': (
                "Teaching Approach:\n"
                "- Begin each concept with a mermaid diagram/flowchart\n"
                "- Use color-coded markdown tables for comparisons\n"
                "- Include 2-3 annotated visual examples\n"
                "- Add 'Visual Insight' callout boxes with SVG graphics"
            ),
            'auditory': (
                "Teaching Approach:\n"
                "- Use conversational, lecture-style explanations\n"
                "- Include audio transcript formatting with timestamps\n"
                "- Add memorable rhymes/acronyms (highlight with 🎵 icon)\n"
                "- Embed interactive audio quizzes with transcript gaps"
            ),
            'kinesthetic': (
                "Teaching Approach:\n"
                "- Create browser-executable code playgrounds\n"
                "- Add draggable/droppable HTML elements\n"
                "- Include step-by-step virtual labs\n"
                "- Embed interactive simulations with jsFiddle/CodePen\n"
                "- Use reaction-based learning (click-to-reveal steps)"
            )
        }.get(learning_style, "")

        if learning_style == 'kinesthetic':
            prompt = f"""Create an interactive learning module for {topic} at {difficulty_level} level.

**Role**: You are Coach Kinesto, Interactive Learning Guide. Craft a personalized, highly detailed lesson  for a solo learner.

**Student Profile**:
- Learning style: {learning_style}
- Topic: {topic}
- Level: {difficulty_level}
- Format: Self-paced virtual study

**Lesson Requirements**:
1. Begin with a direct teacher address: "Welcome to your personalized lesson..."
2. Organize the lesson into clearly defined modules that build on each other:
   - Minimum 3 modules for beginner
   - 5 for intermediate
   - 6 for expert
3. For each module:
   - - Explain concepts with THREE LEVELS of depth:
     1. 💡 Intuitive Understanding (everyday analogy)
     2. 🧠 Formal Definition (technical specification) 
     3. 🛠️ Practical Application (implementation guide)
   - Add to existing content:
     * "Deep Dive" subsection with:
       - Historical context timeline
       - 3 real-world use cases
       - Cross-domain connections
     * "Troubleshooting Guide" containing:
       - 5 common errors (ranked by frequency)
       - Debugging workflow diagram
       - Prevention strategies
   - consist minimum 1200 words
   - Use kinesthetic-optimized methods
   - Include interactive elements from: {self.get_interactive_elements(learning_style)}
   - Add hands-on exercises using {self.get_scenario_method(learning_style)}
   - Include mistake prevention section
4. Conclude each module with progress checkpoints

**Interactive Elements Format**:
Use these exact formats for interactive elements:

1. Code Playground:
```playground
{{
    "language": "python",
    "initialCode": "# Your code here",
    "testCases": [
        {{"input": "example", "expected": "output"}}
    ]
}}
```

2. Virtual Lab:
```lab
{{
    "title": "Lab Title",
    "steps": [
        {{"instruction": "Step instruction", "action": "action"}}
    ]
}}
```

3. Interactive Simulation:
```simulation
{{
    "type": "visualization",
    "topic": "{topic}",
    "difficulty": "{difficulty_level}",
    "interactive": true
}}
```

4. Drag and Drop Exercise:
```drag-drop
{{
    "items": [
        {{"id": "1", "content": "Content", "category": "basic"}}
    ],
    "zones": [
        {{"id": "zone1", "accepts": ["basic"]}}
    ]
}}
```

5. Reveal Steps:
```reveal
{{
    "steps": [
        {{"title": "Step Title", "content": "Step content"}}
    ]
}}
```

**Format Requirements**:
- Start with # Title
- Use ## for Module titles (## Module 1: Title)
- Use ### for Section titles
- Include at least one interactive element per section
- Use emojis for key points (📚, ⚠️, 💡)
- Add progress checks at module ends

{style_instructions}
"""
            
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel("gemini-2.0-flash")
                response = model.generate_content(prompt)
                
                try:
                    # Parse the JSON response
                    content_json = json.loads(response.text)
                    
                    # Generate HTML content from the structured JSON
                    html_content = []
                    html_content.append(f"<h1>{content_json['title']}</h1>")
                    
                    for module_index, module in enumerate(content_json['modules'], 1):
                        html_content.append(f'<div class="module" id="module-{module_index}">')
                        html_content.append(f'<h2>Module {module_index}: {module["title"]}</h2>')
                        html_content.append(f'<div class="module-intro">{module["introduction"]}</div>')
                        
                        for section_index, section in enumerate(module['sections'], 1):
                            html_content.append(f'<div class="section" id="section-{module_index}-{section_index}">')
                            html_content.append(f'<h3>{section["title"]}</h3>')
                            html_content.append(f'<div class="content">{section["content"]}</div>')
                            
                            if 'interactive' in section:
                                element = section['interactive']
                                if element['type'] == 'code-playground':
                                    html_content.append(generate_code_playground(element['config']))
                                elif element['type'] == 'virtual-lab':
                                    html_content.append(generate_virtual_lab(element['config']))
                                elif element['type'] == 'simulation':
                                    html_content.append(generate_simulation(element['config']))
                                elif element['type'] == 'drag-drop':
                                    html_content.append(generate_drag_drop(element['config']))
                                elif element['type'] == 'reveal-steps':
                                    html_content.append(generate_reveal_steps(element['config']))
                            
                            html_content.append('</div>  <!-- section -->')
                        
                        html_content.append('</div>  <!-- module -->')
                    
                    final_content = "\n".join(html_content)
                except json.JSONDecodeError as e:
                    print(f"JSON parsing error: {str(e)}")
                    print(f"Response text: {response.text}")
                    # If JSON parsing fails, use the raw text
                    final_content = response.text
                
                title = self.extract_title(final_content, topic, difficulty_level)
                description = self.clean_content(final_content, title)
                
                course_content = CourseContent.objects.create(
                    title=title,
                    description=description,
                    content_type='article',
                    difficulty_level=difficulty_level,
                    duration_minutes=self.estimate_duration(description),
                    created_by=request.user,
                )
                
                self.process_diagrams(course_content, description)
                
                user_profile = UserProfile.objects.get(user=request.user)
                user_profile.update_progress(content=course_content, status='not_started')
                
                return Response(CourseContentSerializer(course_content).data, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                return Response({'error': f'Content generation failed: {str(e)}'}, 
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            prompt = f"""
**Role**: You are {{
    'visual': "Professor Visio, Master of Visual Learning",
    'auditory': "Dr. Sonus, Audio Learning Expert",
    'kinesthetic': "Coach Kinesto, Interactive Learning Guide"
}}['{learning_style}']. Craft a personalized, highly detailed lesson for a solo learner.

**Student Profile**:
- Learning style: {learning_style}
- Topic: {topic}
- Level: {difficulty_level}
- Format: Self-paced virtual study

**Lesson Requirements**:
1. Begin with a direct teacher address: "Welcome to your personalized lesson..."
2. Organize the lesson into clearly defined modules that build on each other:
   - Minimum 3 modules for beginner
   - 5 for intermediate
   - 6 for expert
3. For each module:
   - Explain concepts with THREE LEVELS of depth:
     1. 💡 Intuitive Understanding (everyday analogy)
     2. 🧠 Formal Definition (technical specification) 
     3. 🛠️ Practical Application (implementation guide)
   - Add to existing content:
     * "Deep Dive" subsection with:
       - Historical context timeline
       - 3 real-world use cases
       - Cross-domain connections
     * "Troubleshooting Guide" containing:
       - 5 common errors (ranked by frequency)
       - Debugging workflow diagram
       - Prevention strategies
   - Use {learning_style}-optimized methods
   - Include 3 interactive elements from: {self.get_interactive_elements(learning_style)}
   - Add 2 real-world scenarios using {self.get_scenario_method(learning_style)}
   - Include mistake prevention section
   -minimum 1200 words
4. Conclude each module with progress checkpoints

**Diagram Rules**:
1. Mermaid Diagrams:
   - Always start with 'graph LR' or 'flowchart LR'
   - Use simple alphanumeric node IDs (A, B1, etc.)
   - Avoid special characters in node text (no parentheses, colons, or hyphens)
   - Use underscores instead of spaces in node text
   - Keep node text concise and clear
   - Example format:
     ```mermaid
     graph LR
         A[Start] --> B[Process]
         B --> C[End]
     ```

2. SVG Content:
   - Must be a complete SVG string (not an array or object)
   - Must start with <svg and end with </svg> on their own lines
   - Must include xmlns="http://www.w3.org/2000/svg"
   - Must include viewBox attribute
   - All SVG elements must be properly closed
   - Text content must be properly escaped
   - DO NOT use arrays or objects for SVG content
   - Example format for simple diagram:
     ```svg
     <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
         <rect x="20" y="20" width="160" height="60" fill="lightblue" />
         <text x="100" y="55" font-size="14" text-anchor="middle">Simple Text</text>
     </svg>
     ```
   - Example format for flowchart:
     ```svg
     <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
         <rect x="50" y="20" width="100" height="40" fill="#e0e0ff" stroke="#000" />
         <text x="100" y="45" text-anchor="middle">Start</text>
         <line x1="150" y1="40" x2="200" y2="40" stroke="#000" marker-end="url(#arrow)" />
         <rect x="200" y="20" width="100" height="40" fill="#e0e0ff" stroke="#000" />
         <text x="250" y="45" text-anchor="middle">Process</text>
         <defs>
             <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5"
                     markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                 <path d="M 0 0 L 10 5 L 0 10 z" />
             </marker>
         </defs>
     </svg>
     ```
   - Common elements to use:
     - rect: for boxes and containers
     - circle: for dots and nodes
     - line: for connections
     - text: for labels (always use text-anchor="middle" for centered text)
     - path: for custom shapes
     - defs: for reusable elements like markers

**Special Instructions for {learning_style}**:
{style_instructions}

**Format Requirements**:
- Teacher-student dialogue format
- Mermaid diagrams at module starts
- Executable code blocks if technical
- Emojis for key points (📚, ⚠️, 💡)
- Module titles with ## Module X: [Title]
- Progress checks at module ends
"""
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel("gemini-2.0-flash")
                response = model.generate_content(prompt)
                
                title = self.extract_title(response.text, topic, difficulty_level)
                description = self.clean_content(response.text, title)
                
                course_content = CourseContent.objects.create(
                    title=title,
                    description=description,
                    content_type='article',
                    difficulty_level=difficulty_level,
                    duration_minutes=self.estimate_duration(description),
                    created_by=request.user,
                )
                
                self.process_diagrams(course_content, description)
                
                user_profile = UserProfile.objects.get(user=request.user)
                user_profile.update_progress(content=course_content, status='not_started')
                
                return Response(CourseContentSerializer(course_content).data, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                return Response({'error': f'Content generation failed: {str(e)}'}, 
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_interactive_elements(self, style):
        elements = {
            'visual': ["Dynamic diagrams", "Color-coded tables", "Annotation exercises"],
            'auditory': ["Audio transcripts", "Rhyme challenges", "Voice-note style tips"],
            'kinesthetic': ["Code playgrounds", "Virtual labs", "Drag-drop diagrams"]
        }
        return ', '.join(elements.get(style, []))

    def get_scenario_method(self, style):
        methods = {
            'visual': "visual solution maps",
            'auditory': "audio walkthroughs",
            'kinesthetic': "hands-on simulation steps"
        }
        return methods.get(style, "scenario-based learning")


    def extract_title(self, content_text, topic, difficulty_level):
        """Extract title with fallback using parameters"""
        title_match = re.search(r'^#\s+(.*)', content_text, re.MULTILINE)
        if title_match:
            return title_match.group(1).strip()
        return f"{topic}: {difficulty_level} Level Lesson"

    def clean_content(self, content_text, title):
        """Remove title section and JSON metadata from content"""
        # Remove JSON metadata if present
        content_text = re.sub(r'^\s*```json.*?```\s*', '', content_text, flags=re.DOTALL)
        # Remove title
        content_text = content_text.replace(f"# {title}", '', 1)
        return content_text.strip()

    def process_diagrams(self, course_content, description):
        def validate_svg_content(svg_content):
            """Validate and clean SVG content"""
            if not isinstance(svg_content, str):
                print(f"Non-string SVG content received: {type(svg_content)}")
                try:
                    svg_content = str(svg_content)
                except Exception as e:
                    print(f"Failed to convert SVG content: {e}")
                    return None

            # Clean up whitespace and remove code block markers
            svg = svg_content.strip()
            if svg.startswith('```svg'):
                svg = svg[6:].strip()
            if svg.endswith('```'):
                svg = svg[:-3].strip()
            
            # Extract SVG if present
            svg_match = re.search(r'<svg[\s\S]*?</svg>', svg, re.IGNORECASE)
            if not svg_match:
                print(f"No SVG tags found in content: {svg[:100]}...")
                return None
            
            svg = svg_match.group(0)
            
            # Ensure required attributes
            if 'xmlns="http://www.w3.org/2000/svg"' not in svg:
                svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
            
            if 'viewBox' not in svg:
                svg = svg.replace('<svg', '<svg viewBox="0 0 400 200"')
            
            # Clean up any extra whitespace or newlines within tags
            svg = re.sub(r'>\s+<', '><', svg)
            svg = re.sub(r'\s+', ' ', svg)
            
            return svg

        # Extract and process diagrams
        mermaid_pattern = r'```mermaid\n([\s\S]*?)```'
        svg_pattern = r'```svg\n([\s\S]*?)```'
        
        # Process interactive elements patterns
        playground_pattern = r'```playground\n([\s\S]*?)```'
        lab_pattern = r'```lab\n([\s\S]*?)```'
        simulation_pattern = r'```simulation\n([\s\S]*?)```'
        dragdrop_pattern = r'```drag-drop\n([\s\S]*?)```'
        reveal_pattern = r'```reveal\n([\s\S]*?)```'
        
        # Process Mermaid diagrams
        mermaid_matches = re.finditer(mermaid_pattern, description)
        for match in mermaid_matches:
            mermaid_code = match.group(1).strip()
            DiagramPrompt.objects.create(
                course_content=course_content,
                prompt_text=f"Mermaid diagram for {course_content.title}",
                mermaid_code=mermaid_code,
                diagram_type='mermaid'
            )

        # Process SVG content
        svg_matches = re.finditer(svg_pattern, description, re.DOTALL)
        for match in svg_matches:
            svg_content = match.group(1)
            
            # Clean up the content
            svg_content = re.sub(r'\[object Object\]', '', svg_content)
            svg_content = re.sub(r',\s*,', ',', svg_content)
            svg_content = re.sub(r'\s+', ' ', svg_content)
            
            valid_svg = validate_svg_content(svg_content)
            
            if valid_svg:
                DiagramPrompt.objects.create(
                    course_content=course_content,
                    prompt_text=f"SVG diagram for {course_content.title}",
                    mermaid_code=valid_svg,  # Store SVG in mermaid_code field
                    diagram_type='svg'
                )
            else:
                print(f"Invalid SVG content found: {str(svg_content)[:100]}...")

        # Process Code Playground elements
        playground_matches = re.finditer(playground_pattern, description, re.DOTALL)
        for match in playground_matches:
            try:
                config = json.loads(match.group(1).strip())
                DiagramPrompt.objects.create(
                    course_content=course_content,
                    prompt_text=f"Code Playground for {course_content.title}",
                    mermaid_code=json.dumps(config),
                    diagram_type='playground'
                )
            except json.JSONDecodeError as e:
                print(f"Invalid playground JSON: {str(e)}")

        # Process Virtual Lab elements
        lab_matches = re.finditer(lab_pattern, description, re.DOTALL)
        for match in lab_matches:
            try:
                config = json.loads(match.group(1).strip())
                DiagramPrompt.objects.create(
                    course_content=course_content,
                    prompt_text=f"Virtual Lab for {course_content.title}",
                    mermaid_code=json.dumps(config),
                    diagram_type='lab'
                )
            except json.JSONDecodeError as e:
                print(f"Invalid lab JSON: {str(e)}")

        # Process Simulation elements
        simulation_matches = re.finditer(simulation_pattern, description, re.DOTALL)
        for match in simulation_matches:
            try:
                config = json.loads(match.group(1).strip())
                DiagramPrompt.objects.create(
                    course_content=course_content,
                    prompt_text=f"Simulation for {course_content.title}",
                    mermaid_code=json.dumps(config),
                    diagram_type='simulation'
                )
            except json.JSONDecodeError as e:
                print(f"Invalid simulation JSON: {str(e)}")

        # Process Drag and Drop elements
        dragdrop_matches = re.finditer(dragdrop_pattern, description, re.DOTALL)
        for match in dragdrop_matches:
            try:
                config = json.loads(match.group(1).strip())
                DiagramPrompt.objects.create(
                    course_content=course_content,
                    prompt_text=f"Drag and Drop Exercise for {course_content.title}",
                    mermaid_code=json.dumps(config),
                    diagram_type='drag-drop'
                )
            except json.JSONDecodeError as e:
                print(f"Invalid drag-drop JSON: {str(e)}")

        # Process Reveal Steps elements
        reveal_matches = re.finditer(reveal_pattern, description, re.DOTALL)
        for match in reveal_matches:
            try:
                config = json.loads(match.group(1).strip())
                DiagramPrompt.objects.create(
                    course_content=course_content,
                    prompt_text=f"Reveal Steps for {course_content.title}",
                    mermaid_code=json.dumps(config),
                    diagram_type='reveal'
                )
            except json.JSONDecodeError as e:
                print(f"Invalid reveal JSON: {str(e)}")

        # Update has_diagrams flag if any diagrams or interactive elements were created
        if DiagramPrompt.objects.filter(course_content=course_content).exists():
            course_content.has_diagrams = True
            course_content.save()

    def estimate_duration(self, content):
        """Estimate reading time (200 words/minute)"""
        word_count = len(content.split())
        return max(1, round(word_count / 200))

def generate_code_playground(config):
    return f'''
<div class="kinesthetic-playground" data-playground='{json.dumps(config)}'>
</div>
'''

def generate_virtual_lab(config):
    return f'''
<div class="virtual-lab" data-lab='{json.dumps(config)}'>
</div>
'''

def generate_simulation(config):
    return f'''
<div class="interactive-simulation" data-simulation='{json.dumps(config)}'>
</div>
'''

def generate_drag_drop(config):
    return f'''
<div class="drag-drop-exercise" data-items='{json.dumps(config)}'>
</div>
'''

def generate_reveal_steps(config):
    return f'''
<div class="reveal-steps" data-steps='{json.dumps(config)}'>
</div>
'''