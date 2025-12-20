/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getStrategicHint, TargetCandidate } from '../services/geminiService';
import { Point, Bubble, Particle, BubbleColor, DebugInfo } from '../types';
import { Loader2, Trophy, BrainCircuit, Play, MousePointerClick, Eye, Terminal, AlertTriangle, Target, Lightbulb, Monitor } from 'lucide-react';

const PINCH_THRESHOLD = 0.05;
const BUBBLE_RADIUS = 22;
const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);
const GRID_COLS = 12;
const GRID_ROWS = 8;
const SLINGSHOT_BOTTOM_OFFSET = 220;
const MAX_DRAG_DIST = 180;
const MIN_FORCE_MULT = 0.15;
const MAX_FORCE_MULT = 0.45;

const COLOR_CONFIG: Record<BubbleColor, { hex: string, points: number, label: string }> = {
  red:    { hex: '#ef5350', points: 100, label: 'Red' },
  blue:   { hex: '#42a5f5', points: 150, label: 'Blue' },
  green:  { hex: '#66bb6a', points: 200, label: 'Green' },
  yellow: { hex: '#ffee58', points: 250, label: 'Yellow' },
  purple: { hex: '#ab47bc', points: 300, label: 'Purple' },
  orange: { hex: '#ffa726', points: 500, label: 'Orange' }
};

const COLOR_KEYS: BubbleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const adjustColor = (color: string, amount: number) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    const c2h = (c: number) => c.toString(16).padStart(2, '0');
    return "#" + c2h(r) + c2h(g) + c2h(b);
};

const GeminiSlingshot: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  const ballPos = useRef<Point>({ x: 0, y: 0 });
  const ballVel = useRef<Point>({ x: 0, y: 0 });
  const anchorPos = useRef<Point>({ x: 0, y: 0 });
  const isPinching = useRef<boolean>(false);
  const isFlying = useRef<boolean>(false);
  const flightStartTime = useRef<number>(0);
  const bubbles = useRef<Bubble[]>([]);
  const particles = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const captureRequestRef = useRef<boolean>(false);
  const selectedColorRef = useRef<BubbleColor>('red');
  
  const [loading, setLoading] = useState(true);
  const [aiHint, setAiHint] = useState<string | null>("Initializing...");
  const [score, setScore] = useState(0);
  const [selectedColor, setSelectedColor] = useState<BubbleColor>('red');
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);

  const getBubblePos = (row: number, col: number, width: number) => {
    const xOffset = (width - (GRID_COLS * BUBBLE_RADIUS * 2)) / 2 + BUBBLE_RADIUS;
    return { x: xOffset + col * (BUBBLE_RADIUS * 2) + (row % 2 !== 0 ? BUBBLE_RADIUS : 0), y: BUBBLE_RADIUS + row * ROW_HEIGHT };
  };

  const updateAvailableColors = () => {
    const active = new Set<BubbleColor>();
    bubbles.current.forEach(b => b.active && active.add(b.color));
  };

  const initGrid = useCallback((width: number) => {
    const newBubbles: Bubble[] = [];
    for (let r = 0; r < 5; r++) { 
      const cols = r % 2 !== 0 ? GRID_COLS - 1 : GRID_COLS;
      for (let c = 0; c < cols; c++) {
        const { x, y } = getBubblePos(r, c, width);
        newBubbles.push({ id: `${r}-${c}`, row: r, col: c, x, y, color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)], active: true });
      }
    }
    bubbles.current = newBubbles;
    updateAvailableColors();
    setTimeout(() => { captureRequestRef.current = true; }, 2000);
  }, []);

  const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colorKey: BubbleColor) => {
    const base = COLOR_CONFIG[colorKey].hex;
    const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    grad.addColorStop(0, '#fff'); grad.addColorStop(0.2, base); grad.addColorStop(1, adjustColor(base, -60));
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
  };

  useEffect(() => {
    isMounted.current = true;
    if (!videoRef.current || !canvasRef.current || !gameContainerRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    
    canvas.width = gameContainerRef.current.clientWidth;
    canvas.height = gameContainerRef.current.clientHeight;
    anchorPos.current = { x: canvas.width / 2, y: canvas.height - SLINGSHOT_BOTTOM_OFFSET };
    ballPos.current = { ...anchorPos.current };
    initGrid(canvas.width);

    let camera: any = null;
    let hands: any = null;

    const onResults = (results: any) => {
      if (!isMounted.current) return;
      setLoading(false);
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(18, 18, 18, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);

      let handPos: Point | null = null;
      let pinchDist = 1.0;
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        handPos = { x: (1 - (lm[8].x + lm[4].x) / 2) * canvas.width, y: (lm[8].y + lm[4].y) / 2 * canvas.height };
        pinchDist = Math.sqrt(Math.pow(lm[8].x - lm[4].x, 2) + Math.pow(lm[8].y - lm[4].y, 2));
      }

      if (handPos && pinchDist < PINCH_THRESHOLD && !isFlying.current) {
        if (!isPinching.current && Math.sqrt(Math.pow(handPos.x - ballPos.current.x, 2) + Math.pow(handPos.y - ballPos.current.y, 2)) < 100) isPinching.current = true;
        if (isPinching.current) {
            ballPos.current = { ...handPos };
            const dist = Math.sqrt(Math.pow(ballPos.current.x - anchorPos.current.x, 2) + Math.pow(ballPos.current.y - anchorPos.current.y, 2));
            if (dist > MAX_DRAG_DIST) {
                const angle = Math.atan2(ballPos.current.y - anchorPos.current.y, ballPos.current.x - anchorPos.current.x);
                ballPos.current.x = anchorPos.current.x + Math.cos(angle) * MAX_DRAG_DIST;
                ballPos.current.y = anchorPos.current.y + Math.sin(angle) * MAX_DRAG_DIST;
            }
        }
      } else if (isPinching.current) {
        isPinching.current = false;
        const dx = anchorPos.current.x - ballPos.current.x;
        const dy = anchorPos.current.y - ballPos.current.y;
        if (Math.sqrt(dx*dx + dy*dy) > 30) {
            isFlying.current = true; flightStartTime.current = performance.now();
            const mult = MIN_FORCE_MULT + (MAX_FORCE_MULT - MIN_FORCE_MULT) * Math.pow(Math.min(Math.sqrt(dx*dx + dy*dy) / MAX_DRAG_DIST, 1), 2);
            ballVel.current = { x: dx * mult, y: dy * mult };
        } else ballPos.current = { ...anchorPos.current };
      }

      if (isFlying.current) {
          ballPos.current.x += ballVel.current.x; ballPos.current.y += ballVel.current.y;
          if (ballPos.current.x < BUBBLE_RADIUS || ballPos.current.x > canvas.width - BUBBLE_RADIUS) ballVel.current.x *= -1;
          const hit = bubbles.current.find(b => b.active && Math.sqrt(Math.pow(ballPos.current.x - b.x, 2) + Math.pow(ballPos.current.y - b.y, 2)) < BUBBLE_RADIUS * 1.8);
          if (hit || ballPos.current.y < BUBBLE_RADIUS) {
              isFlying.current = false; ballPos.current = { ...anchorPos.current };
              updateAvailableColors(); captureRequestRef.current = true;
              if (hit) { hit.active = false; setScore(s => s + COLOR_CONFIG[hit.color].points); }
          }
      }

      bubbles.current.forEach(b => b.active && drawBubble(ctx, b.x, b.y, BUBBLE_RADIUS - 1, b.color));
      drawBubble(ctx, ballPos.current.x, ballPos.current.y, BUBBLE_RADIUS, selectedColorRef.current);
      ctx.restore();
    };

    hands = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    hands.onResults(onResults);
    
    camera = new window.Camera(video, { 
      onFrame: async () => { 
        if (isMounted.current && videoRef.current && hands) await hands.send({ image: videoRef.current }); 
      }, 
      width: 640, height: 480 
    });
    camera.start().catch(() => {});

    return () => {
        isMounted.current = false;
        if (camera) { camera.stop(); camera = null; }
        if (hands) { hands.close(); hands = null; }
        if (video && video.srcObject) { 
          (video.srcObject as MediaStream).getTracks().forEach(t => t.stop()); 
          video.srcObject = null; 
        }
    };
  }, [initGrid]);

  return (
    <div className="flex w-full h-screen bg-[#121212] overflow-hidden text-[#e3e3e3] dir-rtl">
      <div ref={gameContainerRef} className="flex-1 relative h-full">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0" />
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-[#121212] z-50"><Loader2 className="animate-spin text-blue-500" /></div>}
        <div className="absolute top-6 right-6 z-40 bg-[#1e1e1e] p-5 rounded-[28px] border border-[#444746] shadow-2xl flex items-center gap-4">
            <Trophy className="text-yellow-500" />
            <div className="flex flex-col">
              <span className="text-xs opacity-50 font-bold">ניקוד</span>
              <p className="text-3xl font-bold">{score.toLocaleString()}</p>
            </div>
        </div>
      </div>
      <div className="w-[380px] bg-[#1e1e1e] border-r border-[#444746] p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-6">
           <BrainCircuit className="text-blue-500" />
           <h2 className="font-bold text-sm tracking-widest uppercase">Flash Strategy</h2>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4">
          <p className="text-sm bg-black/30 p-4 rounded-xl border border-white/5 leading-relaxed">{aiHint}</p>
          {debugInfo?.screenshotBase64 && (
            <div className="space-y-2">
              <span className="text-[10px] opacity-30 uppercase font-bold">BOARD SNAPSHOT</span>
              <img src={debugInfo.screenshotBase64} className="rounded-xl border border-white/10 opacity-60" />
            </div>
          )}
        </div>
        <button onClick={() => window.location.reload()} className="mt-4 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all">אתחול משחק</button>
      </div>
    </div>
  );
};

export default GeminiSlingshot;