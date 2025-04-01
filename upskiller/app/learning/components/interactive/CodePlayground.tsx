import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

interface TestCase {
  input: string;
  expected: string;
}

interface CodePlaygroundConfig {
  language: 'python' | 'javascript';  // Update to only allow supported languages
  initialCode: string;
  testCases: TestCase[];
}

interface CodePlaygroundProps {
  config: CodePlaygroundConfig;
}

interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

interface LanguageConfig {
  id: string;
  extension: string;
  defaultCode: string;
  wrapperTemplate: (code: string) => string;
}

const LANGUAGE_CONFIGS: Record<CodePlaygroundConfig['language'], LanguageConfig> = {
  python: {
    id: 'python',
    extension: '.py',
    defaultCode: 'def solution(input=None):\n    # Write your code here\n    return input\n',
    wrapperTemplate: (code: string) => `
import sys
import json

${code}

def main():
    try:
        input_data = sys.stdin.read().strip()
        if input_data:
            result = solution(input_data)
        else:
            result = solution()
        print(str(result))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`,
  },
  javascript: {
    id: 'javascript',
    extension: '.js',
    defaultCode: 'function solution(input = null) {\n  // Write your code here\n  return input;\n}\n',
    wrapperTemplate: (code: string) => `
${code}

try {
  const input = process.stdin.isTTY ? null : require('fs').readFileSync(0, 'utf-8').trim();
  const result = input ? solution(input) : solution();
  console.log(String(result));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
`,
  }
};

const CodePlayground: React.FC<CodePlaygroundProps> = ({ config }) => {
  const [code, setCode] = useState(config.initialCode || LANGUAGE_CONFIGS[config.language]?.defaultCode || '');
  const [output, setOutput] = useState<string | TestResult[]>('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languageConfig, setLanguageConfig] = useState(LANGUAGE_CONFIGS[config.language as keyof typeof LANGUAGE_CONFIGS]);

  useEffect(() => {
    // Update language config when language changes
    const newConfig = LANGUAGE_CONFIGS[config.language as keyof typeof LANGUAGE_CONFIGS];
    if (newConfig) {
      setLanguageConfig(newConfig);
      if (!config.initialCode) {
        setCode(newConfig.defaultCode);
      }
    } else {
      setError(`Unsupported language: ${config.language}`);
    }
  }, [config.language, config.initialCode]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setError(null);
    }
  };

  const executeCode = async (code: string, input: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const wrappedCode = languageConfig.wrapperTemplate(code);

      const response = await fetch('/api/execute-code/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: wrappedCode,
          language: config.language,
          input,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data.output;
    } catch (error) {
      throw new Error(`Failed to execute code: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setError(null);
    setOutput('');

    try {
      const results: TestResult[] = [];
      
      // Run each test case
      for (const test of config.testCases) {
        try {
          const actual = await executeCode(code, test.input);
          const trimmedActual = actual.trim();
          const trimmedExpected = test.expected.trim();
          
          results.push({
            input: test.input,
            expected: trimmedExpected,
            actual: trimmedActual,
            passed: trimmedActual === trimmedExpected
          });
        } catch (error) {
          results.push({
            input: test.input,
            expected: test.expected,
            actual: `Error: ${error instanceof Error ? error.message : String(error)}`,
            passed: false
          });
        }
      }

      setOutput(results);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred while running the code');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="code-playground" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="editor-container" style={{ border: '1px solid #e2e8f0', borderRadius: '0.375rem', overflow: 'hidden' }}>
        <Editor
          height="300px"
          defaultLanguage={config.language}
          defaultValue={config.initialCode || languageConfig.defaultCode}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on'
          }}
        />
      </div>
      <div className="playground-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button 
          onClick={runCode}
          disabled={isRunning}
          style={{
            backgroundColor: isRunning ? '#9CA3AF' : '#3B82F6',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {isRunning ? 'Running...' : 'Run Code'}
        </button>
        {error && (
          <div style={{ color: '#DC2626', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
      </div>
      {Array.isArray(output) && output.length > 0 && (
        <div className="output-container" style={{ 
          backgroundColor: '#F8FAFC', 
          border: '1px solid #E2E8F0',
          borderRadius: '0.375rem',
          padding: '1rem'
        }}>
          <h4 style={{ marginBottom: '0.5rem', color: '#1F2937' }}>Test Results:</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {output.map((result, index) => (
              <div 
                key={index}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                }}
              >
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>Test Case {index + 1}</span>
                  <span style={{ 
                    color: result.passed ? '#059669' : '#DC2626',
                    backgroundColor: result.passed ? '#ECFDF5' : '#FEF2F2',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem'
                  }}>
                    {result.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#4B5563' }}>
                  <div>Input: {result.input}</div>
                  <div>Expected: {result.expected}</div>
                  <div>Actual: {result.actual}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodePlayground; 