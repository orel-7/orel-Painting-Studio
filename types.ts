
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Point {
  x: number;
  y: number;
  z?: number;
}

export type PaintColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'white' | 'cyan' | 'magenta' | 'lime' | 'pink' | 'teal' | 'gold' | 'silver' | 'brown' | 'indigo' | 'rose' | 'black';

// Added BubbleColor for Slingshot game
export type BubbleColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

// Added Bubble interface for grid elements
export interface Bubble {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  color: BubbleColor;
  active: boolean;
}

// Added Particle interface for explosion effects
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

// Added DebugInfo for AI analysis tracking
export interface DebugInfo {
  latency: number;
  screenshotBase64: string;
  promptContext: string;
  rawResponse: string;
  timestamp: string;
  parsedResponse?: any;
  error?: string;
}

// Added TargetCandidate for strategic planning
export interface TargetCandidate {
  id: string;
  color: BubbleColor;
  size: number;
  row: number;
  col: number;
  pointsPerBubble: number;
  description: string;
}

// Added AiResponse for consistent service returns
export interface AiResponse {
  hint: any;
  debug: DebugInfo;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

export type HandAction = 'draw' | 'erase' | 'none' | 'text' | 'smart';
export type HUDPosition = 'top' | 'bottom' | 'left' | 'right';

export interface HandConfig {
  leftHand: HandAction;
  rightHand: HandAction;
}

export interface CanvasSettings {
  useStylus: boolean;
  useMouse: boolean;
  showMouseButtons: boolean;
  showTouchButtons: boolean;
  lightTheme: boolean;
  isMirrored: boolean;
  is3DEnabled: boolean;
  autoBrushSize: boolean;
  stickyDraw: boolean;
  maxHands: number;
  hudPosition: HUDPosition;
  gesturesEnabled: boolean;
  zoomLevel: number;
  showLandmarks: boolean;
  cameraFollow: boolean;
}

export interface DrawingBoard {
  id: string;
  dataUrl: string;
  timestamp: number;
  name?: string;
}

export interface VideoRecording {
  id: string;
  url: string;
  thumbnail: string;
  timestamp: number;
  duration: number;
  speedMultiplier: number;
}

/**
 * Interface for the AI Studio key selection utility.
 */
// Fix: Renamed to AIStudio to match existing global type expectations and fix subsequent declaration error
export interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
    // Updated type to AIStudio and removed optionality to align with global declaration requirements
    aistudio: AIStudio;
  }
}
