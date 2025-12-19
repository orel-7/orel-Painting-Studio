
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Point, Stroke, PaintColor, HandAction, HandConfig, CanvasSettings, DrawingBoard, HUDPosition, TextLayer } from '../types';
import { 
  Loader2, Palette, Eraser, Download, Eye, Settings, Trash2, Maximize, Hand as HandIcon,
  Type, Timer, Sun, Moon, Image as ImageIcon, CheckCircle2, Camera,
  X, Printer, Share2, MessageCircle, ChevronRight, ChevronLeft, Keyboard,
  Plus, Layers, Box, Zap, MousePointer, ZoomIn, ZoomOut, Video, Film, Save, RefreshCw, Copy, Scan
} from 'lucide-react';

const PINCH_THRESHOLD = 0.035; 
const FIST_THRESHOLD = 0.08; 
const VIRTUAL_PRESS_DURATION = 3000; // 3 seconds per request

const COLORS: Record<PaintColor, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffee58',
  purple: '#ab47bc',
  orange: '#ffa726',
  white: '#ffffff',
  cyan: '#00e5ff',
  magenta: '#ff4081',
  lime: '#c6ff00',
  pink: '#f48fb1',
  teal: '#00bfa5',
  gold: '#ffd600',
  silver: '#bdbdbd',
  brown: '#795548',
  indigo: '#3f51b5',
  rose: '#e91e63'
};

const GeminiPainter: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const handsInstance = useRef<any>(null);
  const cameraInstance = useRef<any>(null);

  // Logic Refs
  const currentStrokes = useRef<Record<string, Stroke | null>>({});
  const lastPoints = useRef<Record<string, Point | null>>({});
  const activeColor = useRef<string>(COLORS.cyan);
  const activeButtonsRef = useRef<Record<string, number>>({});
  const mouseIsDown = useRef(false);

  // State
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedColor, setSelectedColor] = useState<PaintColor>('cyan');
  const [hideUI, setHideUI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [settings, setSettings] = useState<CanvasSettings>({
    useStylus: true,
    useMouse: true,
    lightTheme: false,
    isMirrored: true,
    is3DEnabled: true,
    autoBrushSize: false,
    stickyDraw: false,
    maxHands: 2,
    hudPosition: 'top',
    gesturesEnabled: true,
    zoomLevel: 1,
    showLandmarks: true,
    cameraFollow: false
  });
  
  const [handConfig, setHandConfig] = useState<HandConfig>({
    leftHand: 'erase',
    rightHand: 'draw'
  });

  const [gallery, setGallery] = useState<DrawingBoard[]>([]);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [drawingPaused, setDrawingPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [brushSize, setBrushSize] = useState(15);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const clearCanvas = useCallback(() => {
    const dctx = drawingCanvasRef.current?.getContext('2d');
    if (dctx) dctx.clearRect(0, 0, drawingCanvasRef.current!.width, drawingCanvasRef.current!.height);
    setTextLayers([]);
  }, []);

  const saveToGallery = useCallback(() => {
    if (!drawingCanvasRef.current) return;
    const currentData = drawingCanvasRef.current.toDataURL();
    setGallery(prev => [{ id: Date.now().toString(), dataUrl: currentData, timestamp: Date.now() }, ...prev]);
  }, []);

  const createNewBoard = useCallback(() => {
    saveToGallery();
    clearCanvas();
  }, [saveToGallery, clearCanvas]);

  const startRecording = () => {
    if (!canvasRef.current) return;
    const stream = canvasRef.current.captureStream(30);
    recorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
    chunksRef.current = [];
    recorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setCapturedVideo(URL.createObjectURL(blob));
    };
    recorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
    // Auto-open Cheese with video
    setCapturedImage(drawingCanvasRef.current?.toDataURL() || null);
  };

  const takeSnapshot = useCallback(() => {
    if (!canvasRef.current) return;
    setCapturedImage(canvasRef.current.toDataURL());
    saveToGallery();
  }, [saveToGallery]);

  // Added shareWork function to fix "Cannot find name 'shareWork'" error
  const shareWork = useCallback(async () => {
    if (!capturedImage) return;
    try {
      if (navigator.share) {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], 'art.png', { type: 'image/png' });
        await navigator.share({
          title: 'היצירה שלי - סטודיו אוראל גולד',
          files: [file],
        });
      } else {
        alert("שיתוף לא נתמך בדפדפן זה. ניתן להוריד את התמונה.");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  }, [capturedImage]);

  const startCountdown = () => {
    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) setCountdown(count);
      else {
        clearInterval(interval);
        setCountdown(null);
        takeSnapshot();
      }
    }, 1000);
  };

  const getToolFromGesture = (landmarks: any, handedness: string): HandAction => {
    if (!settings.gesturesEnabled) return handedness === 'Left' ? handConfig.leftHand : handConfig.rightHand;
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const palmBase = landmarks[0];
    const dists = [8, 12, 16, 20].map(i => {
      const t = landmarks[i];
      return Math.sqrt(Math.pow(t.x - palmBase.x, 2) + Math.pow(t.y - palmBase.y, 2));
    });
    // Closed hand = erase
    if (dists.every(d => d < FIST_THRESHOLD)) return 'erase';
    // Pinch = based on setting
    const pinchDist = Math.sqrt(Math.pow(indexTip.x - thumbTip.x, 2) + Math.pow(indexTip.y - thumbTip.y, 2));
    if (pinchDist < PINCH_THRESHOLD) return handedness === 'Left' ? handConfig.leftHand : handConfig.rightHand;
    return 'none';
  };

  const virtualButtons = useMemo(() => [
    { id: 'clear', label: 'נקה', icon: <Trash2 size={24}/>, action: clearCanvas },
    { id: 'new', label: 'חדש', icon: <Plus size={24}/>, action: createNewBoard },
    { id: 'cam', label: 'צילום', icon: <Camera size={24}/>, action: takeSnapshot },
    { id: 'rec', label: isRecording ? 'עצור' : 'הקלט', icon: isRecording ? <Film size={24}/> : <Video size={24}/>, action: isRecording ? stopRecording : startRecording },
    { id: 'zoom', label: 'זום', icon: settings.zoomLevel > 1 ? <ZoomOut size={24}/> : <ZoomIn size={24}/>, action: () => setSettings(s => ({...s, zoomLevel: s.zoomLevel > 1 ? 1 : 1.4})) },
  ], [isRecording, settings.zoomLevel, clearCanvas, createNewBoard, takeSnapshot]);

  const getHUDCoords = useCallback((width: number, height: number, index: number, total: number) => {
    const spacing = 95;
    const startX = (width - (total * spacing)) / 2;
    switch (settings.hudPosition) {
      case 'bottom': return { x: startX + index * spacing, y: height - 130 };
      case 'left': return { x: 40, y: (height - (total * spacing)) / 2 + index * spacing };
      case 'right': return { x: width - 130, y: (height - (total * spacing)) / 2 + index * spacing };
      default: return { x: startX + index * spacing, y: 40 };
    }
  }, [settings.hudPosition]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !drawingCanvasRef.current || !containerRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const dCanvas = drawingCanvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d')!;
    const dctx = dCanvas.getContext('2d')!;

    const onResults = (results: any) => {
      setLoading(false);
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Video BG
      if (settings.isMirrored) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Draw Drawing Canvas with Zoom (ONLY the content)
      ctx.save();
      ctx.translate(canvas.width/2, canvas.height/2);
      ctx.scale(settings.zoomLevel, settings.zoomLevel);
      ctx.translate(-canvas.width/2, -canvas.height/2);
      ctx.drawImage(dCanvas, 0, 0);

      // Render Text Layers inside zoom
      textLayers.forEach(tl => {
        ctx.fillStyle = tl.color; ctx.font = `bold ${tl.size}px Assistant`; ctx.textAlign = 'center';
        ctx.fillText(tl.text, tl.x, tl.y);
      });
      ctx.restore();

      // HUD - NOT ZOOMED
      if (!hideUI) {
        virtualButtons.forEach((btn, i) => {
          const coords = getHUDCoords(canvas.width, canvas.height, i, virtualButtons.length);
          const pressStart = activeButtonsRef.current[btn.id];
          const progress = pressStart ? (Date.now() - pressStart) / VIRTUAL_PRESS_DURATION : 0;
          
          ctx.fillStyle = settings.lightTheme ? 'rgba(255,255,255,0.95)' : 'rgba(20,20,20,0.9)';
          ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.beginPath(); ctx.roundRect(coords.x, coords.y, 85, 85, 20); ctx.fill();
          ctx.shadowBlur = 0;

          if (progress > 0) {
            ctx.strokeStyle = '#42a5f5'; ctx.lineWidth = 6; ctx.beginPath();
            ctx.arc(coords.x + 42.5, coords.y + 42.5, 36, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * Math.min(progress, 1)));
            ctx.stroke();
          }
          ctx.fillStyle = settings.lightTheme ? '#111' : '#fff';
          ctx.font = 'bold 12px Assistant'; ctx.textAlign = 'center';
          ctx.fillText(btn.label, coords.x + 42.5, coords.y + 75);
        });
      }

      // Hands Logic
      if (results.multiHandLandmarks) {
        const hands = results.multiHandLandmarks.slice(0, settings.maxHands);
        hands.forEach((landmarks: any, idx: number) => {
          const handedness = results.multiHandedness[idx].label;
          const indexTip = landmarks[8];
          const x = settings.isMirrored ? (1 - indexTip.x) : indexTip.x;
          const centerX = x * canvas.width;
          const centerY = indexTip.y * canvas.height;
          const tool = getToolFromGesture(landmarks, handedness);
          const handId = `hand_${idx}_${handedness}`;

          if (settings.showLandmarks && !hideUI) {
            ctx.save();
            if (settings.isMirrored) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {color: '#ffffff33', lineWidth: 1});
            window.drawLandmarks(ctx, landmarks, {color: activeColor.current, radius: 2});
            ctx.restore();
          }

          // Button detection (unzoomed coords)
          virtualButtons.forEach((btn, i) => {
            const coords = getHUDCoords(canvas.width, canvas.height, i, virtualButtons.length);
            const inside = centerX > coords.x && centerX < coords.x + 85 && centerY > coords.y && centerY < coords.y + 85;
            if (inside) {
              if (!activeButtonsRef.current[btn.id]) activeButtonsRef.current[btn.id] = Date.now();
              else if (Date.now() - activeButtonsRef.current[btn.id] > VIRTUAL_PRESS_DURATION) {
                btn.action(); activeButtonsRef.current[btn.id] = Date.now() + 5000;
              }
            } else if (activeButtonsRef.current[btn.id] && Date.now() - activeButtonsRef.current[btn.id] < VIRTUAL_PRESS_DURATION) {
              delete activeButtonsRef.current[btn.id];
            }
          });

          // Adjusted drawing for zoom
          const zX = (centerX - canvas.width/2) / settings.zoomLevel + canvas.width/2;
          const zY = (centerY - canvas.height/2) / settings.zoomLevel + canvas.height/2;

          if (!drawingPaused && (tool === 'draw' || tool === 'erase')) {
            if (!currentStrokes.current[handId]) {
              currentStrokes.current[handId] = { points: [{x: zX, y: zY}], color: tool === 'erase' ? '#000' : activeColor.current, width: brushSize };
              lastPoints.current[handId] = {x: zX, y: zY};
            } else {
              const p = {x: zX, y: zY};
              dctx.beginPath(); dctx.moveTo(lastPoints.current[handId]!.x, lastPoints.current[handId]!.y); dctx.lineTo(p.x, p.y);
              dctx.strokeStyle = tool === 'erase' ? '#000' : activeColor.current;
              dctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
              dctx.lineWidth = brushSize * (tool === 'erase' ? 2 : 1); dctx.lineCap = 'round'; dctx.stroke();
              lastPoints.current[handId] = p;
            }
          } else { currentStrokes.current[handId] = null; lastPoints.current[handId] = null; }

          ctx.beginPath(); ctx.arc(centerX, centerY, brushSize/2 + 2, 0, Math.PI * 2);
          ctx.strokeStyle = tool === 'draw' ? activeColor.current : (tool === 'erase' ? '#ff0000' : '#ffffff22');
          ctx.stroke();
        });
      }

      if (isRecording) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.fillStyle = 'white'; ctx.font = 'bold 14px Assistant'; ctx.textAlign = 'right';
        ctx.fillText("הוקלט ע״י סטודיו אוראל גולד", canvas.width - 20, canvas.height - 15);
        ctx.restore();
      }
    };

    if (!handsInstance.current) {
      handsInstance.current = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      handsInstance.current.setOptions({ maxNumHands: 10, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    }
    handsInstance.current.onResults(onResults);

    if (!cameraInstance.current) {
      cameraInstance.current = new window.Camera(video, { onFrame: async () => { if (videoRef.current) await handsInstance.current.send({ image: videoRef.current }); }, width: 1280, height: 720 });
      cameraInstance.current.start();
    }

    const resize = () => {
      canvas.width = container.clientWidth; canvas.height = container.clientHeight;
      dCanvas.width = container.clientWidth; dCanvas.height = container.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [settings, handConfig, drawingPaused, brushSize, hideUI, isRecording, textLayers, virtualButtons, clearCanvas, createNewBoard, takeSnapshot, getHUDCoords]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!settings.useMouse) return;
    mouseIsDown.current = true;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasRef.current!.width/2) / settings.zoomLevel + canvasRef.current!.width/2;
    const y = (e.clientY - rect.top - canvasRef.current!.height/2) / settings.zoomLevel + canvasRef.current!.height/2;
    
    const curAction = e.button === 0 ? handConfig.rightHand : 'erase';

    if (curAction === 'text') {
      setTextLayers(prev => [...prev, { id: Date.now().toString(), text: inputText || "טקסט", x, y, color: activeColor.current, size: brushSize * 3 }]);
    } else {
      lastPoints.current['mouse'] = { x, y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseIsDown.current || !settings.useMouse) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasRef.current!.width/2) / settings.zoomLevel + canvasRef.current!.width/2;
    const y = (e.clientY - rect.top - canvasRef.current!.height/2) / settings.zoomLevel + canvasRef.current!.height/2;
    const dctx = drawingCanvasRef.current!.getContext('2d')!;
    
    const isErase = e.buttons === 2;
    dctx.beginPath(); dctx.moveTo(lastPoints.current['mouse']!.x, lastPoints.current['mouse']!.y); dctx.lineTo(x, y);
    dctx.strokeStyle = isErase ? '#000' : activeColor.current;
    dctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
    dctx.lineWidth = brushSize * (isErase ? 2 : 1); dctx.lineCap = 'round'; dctx.stroke();
    lastPoints.current['mouse'] = { x, y };
  };

  return (
    <div className={`flex flex-col w-full h-screen ${settings.lightTheme ? 'bg-[#f8f8f8]' : 'bg-[#0a0a0a]'} overflow-hidden font-sans ${settings.lightTheme ? 'text-[#111]' : 'text-[#eee]'} dir-rtl`} style={{ direction: 'rtl' }}>
      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <div className={`transition-all duration-500 ease-in-out h-full overflow-hidden flex shadow-2xl z-40 ${sidebarOpen ? 'w-[340px]' : 'w-0'} ${settings.lightTheme ? 'bg-white' : 'bg-[#151515]'}`}>
          <div className="w-[340px] flex flex-col h-full border-l border-white/5">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2"><Settings className="w-5 h-5 text-blue-400" /><h2 className="text-lg font-bold">הגדרות סטודיו</h2></div>
              <button onClick={() => setShowKeyboard(!showKeyboard)} className="p-2 hover:bg-white/5 rounded-lg"><Keyboard size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold opacity-50"><label>גודל מכחול (1-500px)</label><span>{brushSize}px</span></div>
                <input type="range" min="1" max="500" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1.5 bg-blue-500/20 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold opacity-50">לוח צבעים</label>
                <div className="grid grid-cols-6 gap-2">
                  {(Object.keys(COLORS) as PaintColor[]).map(c => (
                    <button key={c} onClick={() => { activeColor.current = COLORS[c]; setSelectedColor(c); }} className={`w-full aspect-square rounded-lg border-2 transition-all ${selectedColor === c ? 'border-blue-500 scale-110' : 'border-transparent opacity-60'}`} style={{ backgroundColor: COLORS[c] }} />
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5 text-xs">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center"><span>יד ימין (Pinch):</span><select value={handConfig.rightHand} onChange={e => setHandConfig(p => ({...p, rightHand: e.target.value as HandAction}))} className="bg-white/5 p-1 rounded"><option value="draw">ציור</option><option value="erase">מחק</option><option value="text">טקסט</option><option value="none">ללא</option></select></div>
                  <div className="flex justify-between items-center"><span>יד שמאל (Pinch):</span><select value={handConfig.leftHand} onChange={e => setHandConfig(p => ({...p, leftHand: e.target.value as HandAction}))} className="bg-white/5 p-1 rounded"><option value="draw">ציור</option><option value="erase">מחק</option><option value="text">טקסט</option><option value="none">ללא</option></select></div>
                </div>
              </div>

              <div className="pt-4 space-y-4 border-t border-white/5 text-xs">
                <div className="flex items-center justify-between"><span>לחצני מגע</span><button onClick={() => setSettings(s => ({...s, useStylus: !s.useStylus}))} className={`w-8 h-4 rounded-full relative transition-colors ${settings.useStylus ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.useStylus ? 'right-4' : 'right-0.5'}`} /></button></div>
                <div className="flex items-center justify-between"><span>לחצני עכבר</span><button onClick={() => setSettings(s => ({...s, useMouse: !s.useMouse}))} className={`w-8 h-4 rounded-full relative transition-colors ${settings.useMouse ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.useMouse ? 'right-4' : 'right-0.5'}`} /></button></div>
                <div className="flex items-center justify-between"><span>הצג נקודות ידיים</span><button onClick={() => setSettings(s => ({...s, showLandmarks: !s.showLandmarks}))} className={`w-8 h-4 rounded-full relative transition-colors ${settings.showLandmarks ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.showLandmarks ? 'right-4' : 'right-0.5'}`} /></button></div>
                <div className="flex items-center justify-between"><span>מיקום HUD</span><select value={settings.hudPosition} onChange={e => setSettings(s => ({...s, hudPosition: e.target.value as HUDPosition}))} className="bg-white/5 p-1 rounded"><option value="top">למעלה</option><option value="bottom">למטה</option><option value="left">שמאל</option><option value="right">ימין</option></select></div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold opacity-50"><Layers size={14}/> גלריית לוחות</div>
                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-1 border border-white/5 rounded-xl">
                  {gallery.map((board) => (
                    <div key={board.id} className="aspect-video bg-black/40 rounded-lg border border-white/10 relative overflow-hidden group">
                      <img src={board.dataUrl} className="w-full h-full object-contain" alt="saved" />
                      <div className="absolute inset-0 bg-blue-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                        <button onClick={() => { const img = new Image(); img.onload = () => drawingCanvasRef.current?.getContext('2d')?.drawImage(img, 0, 0); img.src = board.dataUrl; }} className="p-1 bg-white/20 rounded"><Copy size={14}/></button>
                        <button onClick={() => { const a = document.createElement('a'); a.href = board.dataUrl; a.download = 'orel_board.png'; a.click(); }} className="p-1 bg-white/20 rounded"><Download size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 bg-black/10 border-t border-white/5">
              <button onClick={startCountdown} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3">
                <Timer size={20}/> ספירה לאחור
              </button>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div ref={containerRef} className="flex-1 relative h-full bg-black" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => mouseIsDown.current = false} onContextMenu={e => e.preventDefault()}>
          <video ref={videoRef} className="absolute hidden" />
          <canvas ref={canvasRef} className="absolute inset-0 z-10" />
          <canvas ref={drawingCanvasRef} className="hidden" />

          {!sidebarOpen && !hideUI && (
            <button onClick={() => setSidebarOpen(true)} className="absolute top-6 right-6 z-50 p-3 bg-[#1e1e1e] rounded-full shadow-2xl border border-white/10 hover:scale-110 transition-transform"><ChevronLeft/></button>
          )}
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="absolute top-1/2 -translate-y-1/2 left-[325px] z-50 p-2 bg-[#1e1e1e] rounded-full shadow-xl border border-white/10"><ChevronRight/></button>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#0a0a0a]">
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                <p className="text-sm font-bold opacity-50 tracking-widest">טוען סטודיו אוראל גולד...</p>
              </div>
            </div>
          )}

          {countdown !== null && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md"><div className="text-[12rem] font-black text-white animate-ping">{countdown}</div></div>
          )}

          {showKeyboard && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e]/95 p-4 rounded-2xl border border-white/10 shadow-2xl flex gap-3 animate-in slide-in-from-bottom">
              <input autoFocus type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="הקלד כאן..." className="bg-black/50 p-2 rounded-lg outline-none border border-white/5 focus:border-blue-500 min-w-[200px]" />
              <button onClick={() => setShowKeyboard(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><X size={16}/></button>
            </div>
          )}

          {capturedImage && (
            <div className="absolute inset-0 z-[100] bg-black/85 flex items-center justify-center p-8 backdrop-blur-xl animate-in zoom-in duration-300">
              <div className="max-w-5xl w-full bg-[#1e1e1e] rounded-[40px] overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row">
                <div className="flex-1 bg-black/40 p-4 relative">
                  <img src={capturedImage} className="w-full h-full object-contain rounded-2xl" alt="Captured Art" />
                </div>
                <div className="w-full md:w-[320px] p-8 flex flex-col gap-6 bg-[#202020]">
                  <div className="flex justify-between items-center"><h3 className="text-2xl font-bold text-blue-400">היצירה מוכנה!</h3><button onClick={() => setCapturedImage(null)}><X/></button></div>
                  <div className="space-y-3">
                    <button onClick={() => { const a = document.createElement('a'); a.href = capturedImage; a.download = prompt("בחר שם קובץ:", "orel_gold_art") + ".png"; a.click(); }} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-3 px-4 transition-all"><Download size={18} className="text-green-400" /> שמור תמונה</button>
                    {capturedVideo && <a href={capturedVideo} download="orel_timelapse.webm" className="w-full py-3 bg-blue-600 text-white rounded-xl flex items-center gap-3 px-4 transition-all font-bold"><Film size={18} /> הורד וידאו סטודיו</a>}
                    <button onClick={shareWork} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-3 px-4 transition-all"><Share2 size={18} className="text-blue-400" /> שיתוף מהיר</button>
                    <button onClick={() => setCapturedImage(null)} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold mt-4">חזרה לסטודיו</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className={`${settings.lightTheme ? 'bg-white border-t-gray-200 text-gray-600' : 'bg-[#121212] border-t-white/5 text-gray-400'} border-t py-4 px-8 z-50`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">נוצר על ידי אוראל גולד</span>
            <span className="opacity-20">|</span>
            <span className="text-[10px] opacity-60">Orel Gold © 2026</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[11px]">
            <a href="https://linktr.ee/orel_7" target="_blank" className="hover:text-blue-400">מרכז קישורים</a>
            <a href="https://timerstosend.vercel.app/" target="_blank" className="hover:text-blue-400">אתר טיימרים</a>
            <a href="https://orelgold7.blogspot.com/" target="_blank" className="hover:text-blue-400">הבלוג של אוראל</a>
            <a href="https://gold3210.wixsite.com/orel" target="_blank" className="hover:text-blue-400">אתר ראשי</a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLScf_p-paTd_NyDySZ6lgfDUaGdoMc0nEo_MQ3w2sPtsplXOrw/viewform" target="_blank" className="font-bold text-blue-400">יצירת קשר</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GeminiPainter;
