import React, { useEffect, useState, HTMLAttributes } from 'react';
import ReactMarkdown, { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import 'highlight.js/styles/github-dark.css';
import './markdown-overides.css';
import KinestheticElements from './components/KinestheticElements';

// Initialize mermaid with optimal settings
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  flowchart: { 
    curve: 'basis',
    padding: 15
  },
  sequence: {
    actorMargin: 50,
    messageMargin: 40
  },
  fontFamily: 'system-ui, -apple-system, sans-serif',
  logLevel: 'error',
  deterministicIds: true,
  maxTextSize: 50000
});

interface Module {
  id: string | number;
  number: number;
  title: string;
  content: string;
}

interface ModuleRendererProps {
  modules: Module[];
}

interface KinestheticDivProps extends HTMLAttributes<HTMLDivElement> {
  'data-playground'?: string;
  'data-lab'?: string;
  'data-simulation'?: string;
  'data-items'?: string;
  'data-steps'?: string;
}

// Helper function to clean and validate Mermaid content
const cleanMermaidContent = (content: string): string => {
  // Remove any leading/trailing whitespace and empty lines
  let cleaned = content.trim().replace(/^\s*[\r\n]/gm, '').replace(/\s+$/gm, '');
  
  // If content starts with "```mermaid", remove it
  cleaned = cleaned.replace(/^```mermaid\n?/, '').replace(/```$/, '');
  
  // Sanitize node text - replace problematic characters and spaces
  cleaned = cleaned.split('\n').map(line => {
    // Handle node definitions and connections
    return line.replace(/\[(.*?)\]/g, (match, text) => {
      // Replace spaces and special characters in node text
      const sanitized = text
        .replace(/\s+/g, '_')           // Replace spaces with underscores
        .replace(/[()]/g, '')           // Remove parentheses
        .replace(/[-]/g, '_')           // Replace hyphens with underscores
        .replace(/[&]/g, 'and')         // Replace & with 'and'
        .replace(/[:]/g, '_')           // Replace colons with underscores
        .replace(/[?]/g, '')            // Remove question marks
        .replace(/[,\.]/g, '')          // Remove commas and periods
        .replace(/__+/g, '_');          // Replace multiple underscores with single
      return `[${sanitized}]`;
    });
  }).join('\n');
  
  // Add proper diagram type if missing
  if (!cleaned.match(/^(graph|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|flowchart|journey)/)) {
    if (cleaned.includes('-->')) {
      cleaned = 'graph LR\n' + cleaned;
    } else if (cleaned.includes('->')) {
      cleaned = 'flowchart LR\n' + cleaned;
    }
  }
  
  return cleaned;
};

const MermaidDiagram = ({ content }: { content: string }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!content || typeof content !== 'string') {
        setError('Invalid or empty diagram content');
        return;
      }

      try {
        const cleanContent = cleanMermaidContent(content);
        
        // Pre-parse to catch syntax errors
        await mermaid.parse(cleanContent);
        
        // If parse succeeds, render
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, cleanContent);
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error("Mermaid Error:", err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
        setError(errorMessage.replace('Syntax error in graph:', 'Syntax error:'));
        setSvg(''); // Clear any previous SVG
      }
    };

    renderDiagram();
  }, [content]);

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg my-4">
        <p className="text-red-600 dark:text-red-400">
          <strong>Diagram Error:</strong> {error}
        </p>
        <pre className="mt-2 text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
          {content}
        </pre>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Please check your diagram syntax and ensure it starts with a valid diagram type (e.g., graph, flowchart, sequenceDiagram).
        </p>
      </div>
    );
  }

  return svg ? (
    <div 
      ref={containerRef}
      className="mermaid-output my-6 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : null;
};

// Update the transformSvgContent function
const transformSvgContent = (content: unknown): string | null => {
  console.log('SVG Transform Input:', content);
  
  // Helper function to extract SVG from string
  const extractSvgFromString = (str: string): string | null => {
    // Clean up the input string
    const cleaned = str
      .replace(/\[object Object\],?/g, '')  // Remove [object Object]
      .replace(/,+/g, ' ')                  // Replace commas with spaces
      .replace(/```svg/g, '')               // Remove SVG code block markers
      .replace(/```/g, '')                  // Remove code block markers
      .trim();

    // If we have text content that's not part of an SVG, wrap it in an SVG
    if (!cleaned.includes('<svg') && cleaned.length > 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
        <rect x="10" y="10" width="380" height="180" fill="#e0f7fa" stroke="#000"/>
        <text x="200" y="100" font-size="16" text-anchor="middle">${cleaned}</text>
      </svg>`;
    }

    // Extract SVG content
    const svgMatch = cleaned.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      let svg = svgMatch[0];
      
      // Ensure required attributes
      if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if (!svg.includes('viewBox')) {
        svg = svg.replace('<svg', '<svg viewBox="0 0 400 200"');
      }
      
      // Fix common SVG issues
      svg = svg
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/&lt;svg/g, '<svg')
        .replace(/&lt;\/svg&gt;/g, '</svg>')
        .replace(/&lt;(\/?)(\w+)/g, '<$1$2')
        .replace(/(\w+)&gt;/g, '$1>');
      
      return svg;
    }
    return null;
  };

  if (!content) return null;
  
  // If content is a string
  if (typeof content === 'string') {
    return extractSvgFromString(content);
  }
  
  // If content is an array
  if (Array.isArray(content)) {
    const joined = content.join(' ');
    return extractSvgFromString(joined);
  }
  
  // If content is an object or array-like string
  if (typeof content === 'object') {
    let str = String(content);
    
    // Extract any text content between object markers
    const textContent = str
      .split(/\[object Object\],?/)
      .filter(Boolean)
      .join(' ')
      .trim();
    
    if (textContent) {
      return extractSvgFromString(textContent);
    }
  }
  
  return null;
};

// Update the cleanSvgContent function
const cleanSvgContent = (content: unknown): string => {
  console.log('Raw SVG content:', content);
  
  const transformed = transformSvgContent(content);
  console.log('Transformed SVG:', transformed);
  
  if (!transformed) {
    console.warn('No valid SVG found, using default');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">' +
      '<rect x="10" y="10" width="380" height="180" fill="#f0f0f0" stroke="#ccc"/>' +
      '<text x="200" y="100" font-size="14" text-anchor="middle" fill="#666">Invalid SVG Content</text>' +
      '</svg>';
  }
  
  // Clean up the SVG
  let cleaned = transformed
    .replace(/>\s+</g, '><')         // Remove whitespace between tags
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;')  // Escape unescaped ampersands
    .replace(/\\"/g, '"')            // Fix escaped quotes
    .replace(/"{2,}/g, '"')          // Fix double quotes
    .replace(/'/g, '&apos;')         // Escape single quotes
    .trim();                         // Remove leading/trailing whitespace
  
  // Fix any remaining quote issues in attributes
  cleaned = cleaned.replace(/(\w+)=\\?"([^"]*?)\\?"/g, '$1="$2"');
  
  // Ensure SVG has required attributes
  if (!cleaned.includes('xmlns="http://www.w3.org/2000/svg"')) {
    cleaned = cleaned.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  
  // Add viewBox if missing
  if (!cleaned.includes('viewBox="')) {
    cleaned = cleaned.replace('<svg', '<svg viewBox="0 0 400 200"');
  }

  // Preserve SVG tag and content structure
  cleaned = cleaned
    .replace(/&lt;svg/g, '<svg')
    .replace(/&lt;\/svg&gt;/g, '</svg>')
    .replace(/&lt;(\/?)(\w+)/g, '<$1$2')
    .replace(/(\w+)&gt;/g, '$1>');
  
  return cleaned;
};

interface SVGContentProps {
  content: unknown;
}

// Update the SVGContent component
const SVGContent: React.FC<SVGContentProps> = ({ content }) => {
  const [error, setError] = useState<string | null>(null);
  const [processedSvg, setProcessedSvg] = useState<string>('');
  
  useEffect(() => {
    try {
      console.log('SVGContent received:', content);
      const cleanedContent = cleanSvgContent(content);
      
      if (!cleanedContent) {
        throw new Error('No valid SVG content found');
      }

      setProcessedSvg(cleanedContent);
      setError(null);
    } catch (err) {
      console.error("SVG Error:", err);
      setError(err instanceof Error ? err.message : 'Failed to process SVG');
      setProcessedSvg('');
    }
  }, [content]);

  if (error) {
    return (
      <div className="p-4 border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg my-4">
        <p className="text-yellow-800 dark:text-yellow-400">
          <strong>SVG Error:</strong> {error}
        </p>
        <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      </div>
    );
  }

  return processedSvg ? (
    <div 
      className="svg-wrapper my-6 flex justify-center overflow-x-auto max-w-full"
      dangerouslySetInnerHTML={{ __html: processedSvg }}
    />
  ) : null;
};

const MarkdownComponents: Components = {
  code: (props) => {
    const { className, children } = props;
    const match = /language-(\w+)/.exec(className || '');
    const lang = match?.[1] || '';
    const codeContent = String(children).trim();

    if (lang === 'mermaid') {
      return <MermaidDiagram content={codeContent} />;
    }

    if (lang === 'svg') {
      return <SVGContent content={codeContent} />;
    }

    return (
      <div className="code-block-wrapper my-6">
        <code
          className={`${className} block bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm`}
          {...props}
        >
          {children}
        </code>
      </div>
    );
  },
  img({ src, alt, ...props }) {
    return (
      <img 
        src={src} 
        alt={alt} 
        className="my-6 rounded-xl mx-auto shadow-lg max-w-full h-auto"
        loading="lazy"
        {...props}
      />
    );
  },
  h3: ({ node, ...props }) => (
    <h3 className="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-gray-100" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="text-xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="my-4 text-lg text-gray-800 dark:text-gray-200 leading-relaxed" {...props} />
  ),
  strong: ({ node, ...props }) => (
    <strong className="font-bold text-blue-700 dark:text-blue-400" {...props} />
  ),
  em: ({ node, ...props }) => (
    <em className="italic text-purple-600 dark:text-purple-400" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="list-disc pl-6 my-4 space-y-2 text-gray-700 dark:text-gray-300" {...props} />
  ),
  li: ({ node, ...props }) => (
    <li className="ml-2 my-1" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 my-6 text-gray-600 dark:text-gray-400 italic" {...props} />
  ),
  div: ({ node, children, ...props }: ExtraProps & KinestheticDivProps) => {
    const className = props.className || '';
    
    // Handle kinesthetic elements
    if (className.includes('kinesthetic-playground')) {
      const data = props['data-playground'];
      if (!data) return null;
      
      try {
        const playgroundData = JSON.parse(data);
        return <KinestheticElements {...playgroundData} />;
      } catch (err) {
        console.error('Error parsing kinesthetic playground data:', err);
        return null;
      }
    }

    // Handle virtual labs
    if (className.includes('virtual-lab')) {
      const data = props['data-lab'];
      if (!data) return null;
      
      try {
        const labData = JSON.parse(data);
        return <KinestheticElements virtualLab={labData} />;
      } catch (err) {
        console.error('Error parsing virtual lab data:', err);
        return null;
      }
    }

    // Handle interactive simulations
    if (className.includes('interactive-simulation')) {
      const data = props['data-simulation'];
      if (!data) return null;
      
      try {
        const simulationData = JSON.parse(data);
        return <KinestheticElements simulation={simulationData} />;
      } catch (err) {
        console.error('Error parsing simulation data:', err);
        return null;
      }
    }

    // Handle drag-drop exercises
    if (className.includes('drag-drop-exercise')) {
      const data = props['data-items'];
      if (!data) return null;
      
      try {
        const itemsData = JSON.parse(data);
        return <KinestheticElements draggableItems={itemsData} />;
      } catch (err) {
        console.error('Error parsing drag-drop data:', err);
        return null;
      }
    }

    // Handle reveal steps
    if (className.includes('reveal-steps')) {
      const data = props['data-steps'];
      if (!data) return null;
      
      try {
        const stepsData = JSON.parse(data);
        return <KinestheticElements revealSteps={stepsData} />;
      } catch (err) {
        console.error('Error parsing reveal steps data:', err);
        return null;
      }
    }

    // Default div rendering with children
    return <div {...props}>{children}</div>;
  },
};

const ModuleRenderer: React.FC<ModuleRendererProps> = ({ modules }) => {
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'neutral',
      flowchart: { curve: 'basis' },
      fontFamily: 'system-ui'
    });
  }, []);

  const preprocessMarkdown = (content: string): string => {
    let processed = '';
    let inCodeBlock = false;
    let currentLanguage = '';
    let svgContent = '';

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Handle code block start/end
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          if (currentLanguage === 'svg' && svgContent) {
            // Clean up SVG content
            const cleanedSvg = svgContent
              .replace(/\[object Object\],?/g, '')  // Remove [object Object]
              .replace(/,+/g, ',')                  // Remove multiple commas
              .trim();
            
            // Only add if it contains valid SVG
            if (cleanedSvg.includes('<svg') && cleanedSvg.includes('</svg>')) {
              processed += cleanedSvg + '\n';
            }
          }
          processed += '```\n';
          inCodeBlock = false;
          currentLanguage = '';
          svgContent = '';
        } else {
          // Start of code block
          const langMatch = line.match(/^```(\w+)/);
          currentLanguage = langMatch ? langMatch[1] : '';
          processed += line + '\n';
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        if (currentLanguage === 'svg') {
          // Collect SVG content
          if (line.includes('<svg')) {
            svgContent += line + '\n';
          } else if (svgContent && line.includes('</svg>')) {
            svgContent += line + '\n';
          } else if (svgContent && !line.includes('[object Object]')) {
            svgContent += line + '\n';
          }
        } else {
          processed += line + '\n';
        }
      } else {
        processed += line + '\n';
      }
    }

    return processed;
  };

  if (!modules || modules.length === 0) {
    return <div className="p-6 text-gray-500">No modules available</div>;
  }

  return (
    <div className="space-y-16 p-6">
      {modules.map((module) => (
        <section key={module.id} className="bg-white dark:bg-gray-900 rounded-3xl p-10 shadow-xl">
          <h2 className="text-4xl font-extrabold mb-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            Module {module.number}: {module.title}
          </h2>

          <div className="prose dark:prose-invert prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              components={MarkdownComponents}
            >
              {preprocessMarkdown(module.content)}
            </ReactMarkdown>
          </div>

          <div className="mt-10 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Interactive Elements</h3>
            <div className="space-y-4">
              <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <p className="text-lg text-gray-800 dark:text-gray-200">
                  Progress checkpoints and interactive elements will appear here.
                </p>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

export default ModuleRenderer;