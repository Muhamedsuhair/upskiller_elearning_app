import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  Settings,
  RefreshCcw
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { useSpeechSynthesis } from 'react-speech-kit';

interface AudioPlayerProps {
  content: string;
  moduleTitle: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ content, moduleTitle }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const positionRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  const { speak, speaking, supported, voices, cancel } = useSpeechSynthesis();

  const processContent = (text: string): string => {
    // Split the content by lines
    const lines = text.split('\n');
    let processedContent = '';
    let isInsideMermaid = false;
    let isInsideInteractive = false;
    let isInsideCodeBlock = false;
    let currentParagraph = '';

    lines.forEach(line => {
      // Skip mermaid diagram sections
      if (line.includes('```mermaid')) {
        isInsideMermaid = true;
        return;
      }
      if (isInsideMermaid && line.includes('```')) {
        isInsideMermaid = false;
        return;
      }
      if (isInsideMermaid) return;

      // Skip interactive elements
      if (line.includes('**(Interactive Element')) {
        isInsideInteractive = true;
        return;
      }
      if (isInsideInteractive && line.includes('**)')) {
        isInsideInteractive = false;
        return;
      }
      if (isInsideInteractive) return;

      // Handle code blocks
      if (line.includes('```')) {
        isInsideCodeBlock = !isInsideCodeBlock;
        if (currentParagraph) {
          processedContent += currentParagraph + '\n\n';
          currentParagraph = '';
        }
        processedContent += line + '\n';
        return;
      }
      if (isInsideCodeBlock) {
        processedContent += line + '\n';
        return;
      }

      // Clean up the line
      let cleanedLine = line
        // Remove timestamps like (0:00)
        .replace(/\(\d+:\d+\)/g, '')
        // Remove markdown symbols
        .replace(/\*\*/g, '')
        // Remove emojis
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu, '')
        // Remove square brackets and their content
        .replace(/\[.*?\]/g, '')
        // Remove parentheses and their content if they contain "Answer" or similar
        .replace(/\(Answer:.*?\)/g, '')
        .trim();

      // Process Dr. Sonus's speech
      if (cleanedLine.startsWith('Dr. Sonus:')) {
        cleanedLine = cleanedLine.replace('Dr. Sonus:', '').trim();
        if (cleanedLine) {
          if (currentParagraph) {
            processedContent += currentParagraph + '\n\n';
            currentParagraph = '';
          }
          currentParagraph = cleanedLine;
        }
      } 
      // Include non-empty lines that aren't headers or special sections
      else if (
        cleanedLine &&
        !cleanedLine.startsWith('#') &&
        !cleanedLine.includes('Real-World Scenario') &&
        !cleanedLine.includes('Progress Checkpoint') &&
        !cleanedLine.includes('Mistake Prevention') &&
        !cleanedLine.startsWith('(Voice note')
      ) {
        // Check if this is a new section or bullet point
        if (cleanedLine.match(/^\d+\./) || // Numbered sections
            cleanedLine.match(/^\* /) ||   // Bullet points
            cleanedLine.match(/^• /) ||    // Bullet points
            cleanedLine.match(/^- /) ||    // Bullet points
            cleanedLine.match(/^(Deep Dive|Practical Application|Formal Definition|Key Points|Summary|Note|Important|Warning|Tip|Example|Exercise|Practice|Challenge|Solution|Answer|Explanation):/i)) {
          if (currentParagraph) {
            processedContent += currentParagraph + '\n\n';
            currentParagraph = '';
          }
          processedContent += cleanedLine + '\n';
        } else {
        if (currentParagraph) {
          currentParagraph += ' ' + cleanedLine;
        } else {
          currentParagraph = cleanedLine;
          }
        }
      }
    });

    // Add the last paragraph if it exists
    if (currentParagraph) {
      processedContent += currentParagraph;
    }

    return processedContent.trim();
  };

  // Process content into chunks
  useEffect(() => {
    const processedContent = processContent(content);
    chunksRef.current = splitIntoChunks(processedContent);
    positionRef.current = 0;
  }, [content]);

  // Handle speech completion
  useEffect(() => {
    if (!speaking && isPlaying) {
      positionRef.current++;
      if (positionRef.current < chunksRef.current.length) {
        playNextChunk();
      } else {
        setIsPlaying(false);
        positionRef.current = 0;
        updateProgress();
      }
    }
  }, [speaking]);

  const playNextChunk = () => {
    if (positionRef.current >= chunksRef.current.length) {
      setIsPlaying(false);
      return;
    }

    const chunk = chunksRef.current[positionRef.current];
    console.log("Playing chunk:", chunk);
    
    try {
      // Cancel any ongoing speech
      cancel();
      
      // Speak the chunk
      speak({
        text: chunk,
        rate: rate,
        voice: voices.find(voice => voice.lang.includes('en-GB')) || voices[0],
        onEnd: () => {
          console.log("Finished speaking chunk");
        },
        onError: (error: any) => {
          console.error('Speech error:', error);
          setError('Error playing audio. Please try again.');
          setIsPlaying(false);
        }
      });
    } catch (err) {
      console.error("Error in playNextChunk:", err);
      setError("Failed to play audio. Please try again.");
      setIsPlaying(false);
    }
  };

  const handlePlayPause = () => {
    console.log("Play/Pause clicked", { isPlaying, supported });
    
    if (!supported) {
      console.error("Speech synthesis not supported");
      setError("Speech synthesis is not supported in your browser. Please try a different browser.");
      return;
    }

    setError(null);
    
    if (isPlaying) {
      console.log("Stopping playback");
      cancel();
      setIsPlaying(false);
    } else {
      console.log("Starting playback");
      if (positionRef.current >= chunksRef.current.length) {
        positionRef.current = 0;
      }
      setIsPlaying(true);
      playNextChunk();
    }
    updateProgress();
  };

  const handleReset = () => {
    cancel();
    setIsPlaying(false);
    positionRef.current = 0;
    setError(null);
    updateProgress();
  };

  // Update voice properties when they change
  useEffect(() => {
    if (isPlaying) {
      cancel();
      playNextChunk();
    }
  }, [rate]);

  const splitIntoChunks = (text: string): string[] => {
    // Split into sections based on numbered items and major headers
    const sections = text.split(/(?=\d+\.|Deep Dive:|Practical Application:|Formal Definition:|Key Points:|Summary:|Note:|Important:|Warning:|Tip:|Example:|Exercise:|Practice:|Challenge:|Solution:|Answer:|Explanation:)/i);
    
    const chunks: string[] = [];
    
    sections.forEach(section => {
      const trimmedSection = section.trim();
      if (!trimmedSection) return;

      // Split section into paragraphs
      const paragraphs = trimmedSection.split(/\n\s*\n/);
      let currentChunk = '';

      paragraphs.forEach(paragraph => {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) return;

        // Check if this is a bullet point or list item
        const isListItem = trimmedParagraph.match(/^[\d*•-]/);
        
        // Check if this is a code block
        const isCodeBlock = trimmedParagraph.includes('```');

        if (isListItem || isCodeBlock) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          chunks.push(trimmedParagraph);
        } else {
          // For regular paragraphs, combine them if they're related
          if (currentChunk) {
            // Check if the current paragraph is a continuation
            const isContinuation = !trimmedParagraph.match(/^[A-Z]/) || // Doesn't start with capital letter
                                 trimmedParagraph.startsWith('And ') ||
                                 trimmedParagraph.startsWith('But ') ||
                                 trimmedParagraph.startsWith('Or ') ||
                                 trimmedParagraph.startsWith('So ') ||
                                 trimmedParagraph.startsWith('Because ') ||
                                 trimmedParagraph.startsWith('However ') ||
                                 trimmedParagraph.startsWith('Therefore ') ||
                                 trimmedParagraph.startsWith('Thus ') ||
                                 trimmedParagraph.startsWith('Hence ') ||
                                 trimmedParagraph.startsWith('Moreover ') ||
                                 trimmedParagraph.startsWith('Furthermore ') ||
                                 trimmedParagraph.startsWith('Additionally ');

            if (isContinuation) {
              currentChunk += ' ' + trimmedParagraph;
            } else {
              chunks.push(currentChunk.trim());
              currentChunk = trimmedParagraph;
            }
          } else {
            currentChunk = trimmedParagraph;
          }
        }
      });

      // Add the last chunk if it exists
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
    });

    // Post-process chunks to ensure they're meaningful
    const processedChunks = chunks
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0)
      .map(chunk => {
        // Ensure proper spacing after common delimiters
        return chunk
          .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Add space between sentences if missing
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
      });

    // Log chunks for debugging
    processedChunks.forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1}:`);
      console.log(chunk);
    });

    return processedChunks;
  };

  const updateProgress = () => {
    if (chunksRef.current.length === 0) {
      setCurrentProgress(0);
      return;
    }
    const progress = Math.round((positionRef.current / chunksRef.current.length) * 100);
    setCurrentProgress(progress);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {moduleTitle}
        </h2>
        {error && (
          <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
            {error}
          </div>
        )}
      </div>

      {/* Main Controls */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-6">
        <div className="flex flex-col gap-4">
          {/* Playback Progress Slider */}
          <div className="w-full space-y-2">
            <Slider
              value={[currentProgress]}
              min={0}
              max={100}
              step={1}
              className="w-full"
              onValueChange={(values: number[]) => {
                try {
                  const newPosition = Math.floor((values[0] / 100) * chunksRef.current.length);
                  positionRef.current = Math.min(newPosition, chunksRef.current.length - 1);
                  setCurrentProgress(values[0]);
                  
                  if (isPlaying) {
                    cancel();
                    playNextChunk();
                  }
                } catch (err) {
                  console.error('Error updating position:', err);
                  setError('Error updating position. Please try again.');
                }
              }}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                Chunk {positionRef.current + 1} of {chunksRef.current.length}
              </span>
              <span>{currentProgress}%</span>
            </div>
          </div>

          {/* Play/Pause Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="default"
                size="lg"
                className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-all"
                onClick={handlePlayPause}
                disabled={isLoading || !supported}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                ) : isPlaying ? (
                  <Pause className="h-6 w-6 text-white" />
                ) : (
                  <Play className="h-6 w-6 text-white ml-1" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleReset}
                disabled={isLoading || !supported}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-4">
        {/* Speed Control */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Settings className="h-3 w-3" />
            <span>Speed ({rate}x)</span>
          </div>
          <Slider
            value={[rate]}
            min={0.5}
            max={2}
            step={0.1}
            className="w-full"
            onValueChange={(values: number[]) => {
              setRate(values[0]);
            }}
          />
        </div>
      </div>

      {/* Content Display */}
      <div className="mt-6 space-y-4">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Current Speech
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 max-h-48 overflow-y-auto">
            <div className="prose dark:prose-invert max-w-none">
              <MarkdownRenderer content={chunksRef.current[positionRef.current] || 'Ready to start...'} />
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Full Transcript
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 max-h-48 overflow-y-auto">
            <div className="prose dark:prose-invert max-w-none">
              <MarkdownRenderer content={content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
