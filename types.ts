
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Point {
  x: number;
  y: number;
  z?: number;
}

export type PaintColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'white' | 'cyan' | 'magenta' | 'lime' | 'pink' | 'teal' | 'gold' | 'silver' | 'brown';

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

// Adding missing types for Slingshot game and Gemini analysis service
export type BubbleColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export interface Bubble {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  color: BubbleColor;
  active: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface DebugInfo {
  latency: number;
  screenshotBase64: string;
  promptContext: string;
  rawResponse: string;
  timestamp: string;
  parsedResponse?: any;
  error?: string;
}

export interface TargetCandidate {
  id: string;
  color: BubbleColor;
  size: number;
  row: number;
  col: number;
  pointsPerBubble: number;
  description: string;
}

export interface AiResponse {
  hint: {
    message: string;
    suggestion?: string;
    detectedSubject?: string;
    artStyle?: string;
    rationale?: string;
    targetRow?: number;
    targetCol?: number;
    recommendedColor?: BubbleColor;
  };
  debug: DebugInfo;
}

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}
