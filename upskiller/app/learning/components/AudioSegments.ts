export interface AudioSegment {
  id: string;
  startTime: number;  // in seconds
  endTime: number;    // in seconds
  speaker: string;
  content: string;
  type: 'lecture' | 'interaction' | 'scenario' | 'checkpoint';
}

export interface AudioTranscript {
  segments: AudioSegment[];
  totalDuration: number;
}
