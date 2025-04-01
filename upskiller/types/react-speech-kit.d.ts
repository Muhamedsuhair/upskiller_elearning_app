declare module 'react-speech-kit' {
  interface SpeechSynthesisVoice {
    lang: string;
    name: string;
    voiceURI: string;
    localService: boolean;
    default: boolean;
  }

  interface SpeechSynthesisOptions {
    text: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice;
    onEnd?: () => void;
    onError?: (error: any) => void;
  }

  interface SpeechSynthesisHook {
    speak: (options: SpeechSynthesisOptions) => void;
    speaking: boolean;
    supported: boolean;
    voices: SpeechSynthesisVoice[];
    cancel: () => void;
  }

  export function useSpeechSynthesis(): SpeechSynthesisHook;
} 