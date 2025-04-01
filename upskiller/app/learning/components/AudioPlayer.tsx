import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  Volume2,
  Settings,
  RefreshCcw
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface AudioPlayerProps {
  content: string;
  moduleTitle: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ content, moduleTitle }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const speechSynthesis = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const contentRef = useRef<string>(content);
  const positionRef = useRef(0);
  const chunksRef = useRef<string[]>([]);

  const processContent = (text: string): string => {
    // Split the content by lines
    const lines = text.split('\n');
    let processedContent = '';
    let isInsideMermaid = false;
    let isInsideInteractive = false;
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
        !cleanedLine.startsWith('```') &&
        !cleanedLine.includes('Real-World Scenario') &&
        !cleanedLine.includes('Progress Checkpoint') &&
        !cleanedLine.includes('Mistake Prevention') &&
        !cleanedLine.startsWith('(Voice note')
      ) {
        if (currentParagraph) {
          currentParagraph += ' ' + cleanedLine;
        } else {
          currentParagraph = cleanedLine;
        }
      }
    });

    // Add the last paragraph if it exists
    if (currentParagraph) {
      processedContent += currentParagraph;
    }

    // Clean up any extra spaces and normalize whitespace
    return processedContent
      .replace(/\s+/g, ' ')
      .replace(/\s+\./g, '.')
      .replace(/\s+,/g, ',')
      .trim();
  };

  useEffect(() => {
    // Process the content before splitting into chunks
    const processedContent = processContent(content);
    chunksRef.current = splitIntoChunks(processedContent);
    contentRef.current = processedContent;
    positionRef.current = 0;

    // Initialize speech synthesis
    setupSpeechSynthesis();

    // Cleanup
    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    };
  }, [content]);

  const splitIntoChunks = (text: string): string[] => {
    // Split by sentences and then into chunks of reasonable size
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    sentences.forEach(sentence => {
      if (currentChunk.length + sentence.length < 200) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      }
    });

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  };

  const setupSpeechSynthesis = () => {
    // Create new utterance for current chunk
    const createUtterance = (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      try {
        // Get available voices
        const voices = speechSynthesis.getVoices();
        console.log('Available voices:', voices.length);
        
        // Try to find a suitable voice in this order: female English > any English > any female > first available
        const femaleEnglishVoice = voices.find(voice => 
          (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('woman')) &&
          voice.lang.toLowerCase().startsWith('en')
        );
        
        const anyEnglishVoice = voices.find(voice => 
          voice.lang.toLowerCase().startsWith('en')
        );
        
        const anyFemaleVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('woman')
        );
        
        const selectedVoice = femaleEnglishVoice || anyEnglishVoice || anyFemaleVoice || voices[0];
        
        if (selectedVoice) {
          console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang;
        } else {
          console.warn('No suitable voice found, using default system voice');
        }
      } catch (err) {
        console.error('Error setting up voice:', err);
        setError('Error setting up voice. Using system default.');
      }

      return utterance;
    };

    // Handle chunk completion
    const handleChunkEnd = () => {
      try {
        positionRef.current++;
        if (positionRef.current < chunksRef.current.length) {
          playNextChunk();
        } else {
          setIsPlaying(false);
          positionRef.current = 0;
        }
      } catch (err) {
        console.error('Error in chunk completion:', err);
        setError('Error during playback. Please try again.');
        setIsPlaying(false);
      }
    };

    // Set up utterance with event handlers
    const setupUtterance = (text: string) => {
      try {
        const utterance = createUtterance(text);
        utterance.onend = handleChunkEnd;
        utterance.onerror = (event) => {
          console.error('Speech synthesis error:', event);
          setError('Error during speech synthesis. Please try again.');
          setIsPlaying(false);
        };
        return utterance;
      } catch (err) {
        console.error('Error setting up utterance:', err);
        setError('Error initializing speech. Please try again.');
        setIsPlaying(false);
        return null;
      }
    };

    // Initialize with first chunk
    if (chunksRef.current.length > 0) {
      utteranceRef.current = setupUtterance(chunksRef.current[0]);
    }
  };

  const updateProgress = () => {
    if (chunksRef.current.length === 0) {
      setCurrentProgress(0);
      return;
    }
    const progress = Math.round((positionRef.current / chunksRef.current.length) * 100);
    setCurrentProgress(progress);
  };

  const playNextChunk = () => {
    if (positionRef.current < chunksRef.current.length) {
      try {
        const utterance = new SpeechSynthesisUtterance(chunksRef.current[positionRef.current]);
        utteranceRef.current = utterance;

        // Set up voice
        const voices = speechSynthesis.getVoices();
        const femaleEnglishVoice = voices.find(voice => 
          (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('woman')) &&
          voice.lang.toLowerCase().startsWith('en')
        );
        if (femaleEnglishVoice) {
          utterance.voice = femaleEnglishVoice;
          utterance.lang = femaleEnglishVoice.lang;
        }

        // Set properties
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;

        // Handle chunk completion
        utterance.onend = () => {
          const nextPosition = positionRef.current + 1;
          if (nextPosition < chunksRef.current.length) {
            positionRef.current = nextPosition;
            updateProgress();
            playNextChunk();
          } else {
            setIsPlaying(false);
            positionRef.current = 0;
            updateProgress();
            console.log('Finished playing all chunks');
          }
        };

        // Handle errors
        utterance.onerror = (event) => {
          console.error('Error playing chunk:', event);
          setError(`Error playing chunk ${positionRef.current + 1}. Please try again.`);
          setIsPlaying(false);
          updateProgress();
        };

        console.log(`Playing chunk ${positionRef.current + 1} of ${chunksRef.current.length}`);
        speechSynthesis.speak(utterance);
        updateProgress();
      } catch (err) {
        console.error('Error in playNextChunk:', err);
        setError('Error playing audio. Please try again.');
        setIsPlaying(false);
        updateProgress();
      }
    } else {
      console.log('No more chunks to play');
      setIsPlaying(false);
      positionRef.current = 0;
      updateProgress();
    }
  };

  const handlePlayPause = () => {
    setError(null);
    
    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      if (positionRef.current >= chunksRef.current.length) {
        positionRef.current = 0;
      }
      setIsPlaying(true);
      playNextChunk();
    }
    updateProgress();
  };

  const handleReset = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    positionRef.current = 0;
    setError(null);
    updateProgress();
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
                    speechSynthesis.cancel();
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

          {/* Play/Pause and Volume Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="default"
                size="lg"
                className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-all"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
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
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Compact Volume Control */}
            <div className="flex items-center gap-2 w-32">
              <Volume2 className="h-4 w-4 text-gray-500" />
              <Slider
                value={[volume]}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
                onValueChange={(values: number[]) => {
                  setVolume(values[0]);
                  if (utteranceRef.current) {
                    utteranceRef.current.volume = values[0];
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-4">
        {/* Speed and Pitch Controls in a more compact layout */}
        <div className="grid grid-cols-2 gap-4">
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
                if (utteranceRef.current) {
                  utteranceRef.current.rate = values[0];
                }
              }}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Settings className="h-3 w-3" />
              <span>Pitch ({pitch}x)</span>
            </div>
            <Slider
              value={[pitch]}
              min={0.5}
              max={2}
              step={0.1}
              className="w-full"
              onValueChange={(values: number[]) => {
                setPitch(values[0]);
                if (utteranceRef.current) {
                  utteranceRef.current.pitch = values[0];
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Content Display - Using MarkdownRenderer for proper formatting */}
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
