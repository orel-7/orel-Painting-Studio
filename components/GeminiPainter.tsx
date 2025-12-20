/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Point, Stroke, PaintColor, HandAction, HandConfig, CanvasSettings, DrawingBoard, HUDPosition, TextLayer, VideoRecording } from '../types';
import { 
  Loader2, Palette, Eraser, Download, Settings, Trash2, Camera,
  X, Share2, ChevronRight, ChevronLeft, Keyboard,
  Plus, Layers, Zap, ZoomIn, ZoomOut, Video, Film, Copy, Play, FastForward, Info,
  AlertTriangle, CheckCircle2
} from 'lucide-react';

const COLORS: Record<PaintColor, string> = {
  red: '#ef5350', blue: '#42a5f5', green: '#66bb6a', yellow: '#ffee58',
  purple: '#ab47bc', orange: '#ffa726', white: '#ffffff', cyan: '#00e5ff',
  magenta: '#ff4081', lime: '#c6ff00', pink: '#f48fb1', teal: '#00bfa5',
  gold: '#ffd600', silver: '#bdbdbd', brown: '#795548', indigo: '#3f51b5',
  rose: '#e91e63', black: '#000000'
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
  const isMounted = useRef(true);

  // Logic Refs
  const currentStrokes = useRef<Record<string, Stroke | null>>({});
  const lastPoints = useRef<Record<string, Point | null>>({});
  const activeColor = useRef<string>(COLORS.cyan);
  const activeButtonsRef = useRef<Record<string, number>>({});
  const mouseIsDown = useRef(false);

  // State
  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedColor, setSelectedColor] = useState<PaintColor>('cyan');
  const [hideUI, setHideUI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [settings, setSettings] = useState<CanvasSettings>({
    useStylus: true, useMouse: true, showMouseButtons: true, showTouchButtons: true,
    lightTheme: false, isMirrored: true, is3DEnabled: true, autoBrushSize: false,
    stickyDraw: false, maxHands: 2, hudPosition: 'top', gesturesEnabled: true,
    zoomLevel: 1, showLandmarks: true, cameraFollow: false
  });
  
  const [gallery, setGallery] = useState<DrawingBoard[]>([]);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [brushSize, setBrushSize] = useState(15);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const clearCanvas = useCallback(() => {
    const dctx = drawingCanvasRef.current?.getContext('2d');
    if (dctx) dctx.clearRect(0, 0, drawingCanvasRef.current!.width, drawingCanvasRef.current!.height);
    setTextLayers([]);
  }, []);

  const saveToGallery = useCallback((name?: string) => {
    if (!drawingCanvasRef.current) return;
    const currentData = drawingCanvasRef.current.toDataURL();
    setGallery(prev => [{ id: Date.now().toString(), dataUrl: currentData, timestamp: Date.now(), name }, ...prev]);
  }, []);

  const createNewBoard = useCallback(() => {
    saveToGallery();
    clearCanvas();
  }, [saveToGallery, clearCanvas]);

  const startRecording = () => {
    if (!canvasRef.current) return;
    try {
      const stream = canvasRef.current.captureStream(30);
      recorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
      chunksRef.current = [];
      recorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = "recording.webm"; a.click();
      };
      recorderRef.current.start();
      setIsRecording(true);
    } catch (e) { console.error("Recording not supported"); }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  const takeSnapshot = useCallback(() => {
    if (!canvasRef.current) return;
    setCapturedImage(canvasRef.current.toDataURL());
    saveToGallery("Snapshot");
  }, [saveToGallery]);

  const startCheatMode = async () => {
    if (gallery.length < 3) return alert("צריך לפחות 3 לוחות כדי להתחיל צ'יט!");
    setHideUI(true); setSidebarOpen(false); clearCanvas();
    const dctx = drawingCanvasRef.current?.getContext('2d');
    if (!dctx) return;
    for (let i = gallery.length - 1; i >= 0; i--) {
      setCountdown(3); await new Promise(r => setTimeout(r, 1000));
      setCountdown(2); await new Promise(r => setTimeout(r, 1000));
      setCountdown(1); await new Promise(r => setTimeout(r, 1000));
      setCountdown(null);
      const img = new Image(); img.src = gallery[i].dataUrl;
      await new Promise(r => { img.onload = () => { dctx.clearRect(0, 0, dctx.canvas.width, dctx.canvas.height); dctx.drawImage(img, 0, 0); r(null); }; });
      await new Promise(r => setTimeout(r, 2000));
    }
    setHideUI(false); setSidebarOpen(true);
  };

  const virtualButtons = useMemo(() => [
    { id: 'clear', label: 'נקה', icon: <Trash2 size={24}/>, action: clearCanvas },
    { id: 'new', label: 'חדש', icon: <Plus size={24}/>, action: createNewBoard },
    { id: 'cam', label: 'צילום', icon: <Camera size={24}/>, action: takeSnapshot },
    { id: 'rec', label: isRecording ? 'עצור' : 'הקלט', icon: isRecording ? <Film size={24}/> : <Video size={24}/>, action: isRecording ? stopRecording : startRecording },
    { id: 'zoom', label: 'זום', icon: settings.zoomLevel > 1 ? <ZoomOut size={24}/> : <ZoomIn size={24}/>, action: () => setSettings(s => ({...s, zoomLevel: s.zoomLevel > 1 ? 1 : 1.4})) },
  ], [isRecording, settings.zoomLevel, clearCanvas, createNewBoard, takeSnapshot]);

  const getHUDCoords = useCallback((width: number, height: number, index: number, total: number) => {
    const spacing = 100;
    const startX = (width - (total * spacing)) / 2;
    return { x: startX + index * spacing, y: settings.hudPosition === 'bottom' ? height - 140 : 40 };
  }, [settings.hudPosition]);

  useEffect(() => {
    isMounted.current = true;
    if (!videoRef.current || !canvasRef.current || !drawingCanvasRef.current || !containerRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const dCanvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const dctx = dCanvas.getContext('2d')!;

    const onResults = (results: any) => {
      if (!isMounted.current) return;
      setLoading(false);
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (settings.isMirrored) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(settings.zoomLevel, settings.zoomLevel);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.drawImage(dCanvas, 0, 0);
      textLayers.forEach(tl => {
        ctx.fillStyle = tl.color; ctx.font = `bold ${tl.size}px Assistant`; ctx.textAlign = 'center';
        ctx.fillText(tl.text, tl.x, tl.y);
      });
      ctx.restore();

      if (!hideUI) {
        virtualButtons.forEach((btn, i) => {
          const coords = getHUDCoords(canvas.width, canvas.height, i, virtualButtons.length);
          const pressStart = activeButtonsRef.current[btn.id];
          const progress = pressStart ? (Date.now() - pressStart) / 2500 : 0;
          ctx.fillStyle = 'rgba(20,20,20,0.9)'; ctx.beginPath(); ctx.roundRect(coords.x, coords.y, 88, 88, 22); ctx.fill();
          if (progress > 0) {
            ctx.strokeStyle = '#42a5f5'; ctx.lineWidth = 6; ctx.beginPath();
            ctx.arc(coords.x + 44, coords.y + 44, 38, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * Math.min(progress, 1)));
            ctx.stroke();
          }
          ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Assistant'; ctx.textAlign = 'center';
          ctx.fillText(btn.label, coords.x + 44, coords.y + 78);
        });
      }

      if (results.multiHandLandmarks) {
        results.multiHandLandmarks.slice(0, settings.maxHands).forEach((landmarks: any, idx: number) => {
          const handedness = results.multiHandedness[idx].label;
          const indexTip = landmarks[8];
          const x = settings.isMirrored ? (1 - indexTip.x) : indexTip.x;
          const centerX = x * canvas.width;
          const centerY = indexTip.y * canvas.height;
          const handId = `hand_${idx}_${handedness}`;

          virtualButtons.forEach((btn) => {
            const coords = getHUDCoords(canvas.width, canvas.height, virtualButtons.indexOf(btn), virtualButtons.length);
            if (centerX > coords.x && centerX < coords.x + 88 && centerY > coords.y && centerY < coords.y + 88) {
              if (!activeButtonsRef.current[btn.id]) activeButtonsRef.current[btn.id] = Date.now();
              else if (Date.now() - activeButtonsRef.current[btn.id] > 2500) { btn.action(); activeButtonsRef.current[btn.id] = Date.now() + 5000; }
            } else if (activeButtonsRef.current[btn.id] && Date.now() - activeButtonsRef.current[btn.id] < 2500) delete activeButtonsRef.current[btn.id];
          });

          const zX = (centerX - canvas.width / 2) / settings.zoomLevel + canvas.width / 2;
          const zY = (centerY - canvas.height / 2) / settings.zoomLevel + canvas.height / 2;

          const thumbTip = landmarks[4];
          const pinchDist = Math.sqrt(Math.pow(landmarks[8].x - thumbTip.x, 2) + Math.pow(landmarks[8].y - thumbTip.y, 2));
          const isDrawing = pinchDist < 0.035;

          if (isDrawing) {
            if (!currentStrokes.current[handId]) {
              currentStrokes.current[handId] = { points: [{x: zX, y: zY}], color: handedness === 'Left' ? '#000' : activeColor.current, width: brushSize };
              lastPoints.current[handId] = {x: zX, y: zY};
            } else {
              dctx.beginPath(); dctx.moveTo(lastPoints.current[handId]!.x, lastPoints.current[handId]!.y); dctx.lineTo(zX, zY);
              dctx.strokeStyle = handedness === 'Left' ? '#000' : activeColor.current;
              dctx.globalCompositeOperation = handedness === 'Left' ? 'destination-out' : 'source-over';
              dctx.lineWidth = brushSize; dctx.lineCap = 'round'; dctx.stroke();
              lastPoints.current[handId] = {x: zX, y: zY};
            }
          } else { currentStrokes.current[handId] = null; lastPoints.current[handId] = null; }
          
          ctx.beginPath(); ctx.arc(centerX, centerY, brushSize/2 + 2, 0, Math.PI * 2);
          ctx.strokeStyle = isDrawing ? activeColor.current : '#ffffff22'; ctx.stroke();
        });
      }
    };

    // ניקוי מופעים ישנים לפני יצירה מחדש
    if (handsInstance.current) { handsInstance.current.close(); handsInstance.current = null; }
    if (cameraInstance.current) { cameraInstance.current.stop(); cameraInstance.current = null; }

    handsInstance.current = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    // רמת מורכבות 0 חוסכת משמעותית ב-RAM ו-CPU
    handsInstance.current.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    handsInstance.current.onResults(onResults);

    cameraInstance.current = new window.Camera(video, { 
      onFrame: async () => { 
        if (isMounted.current && videoRef.current && !videoRef.current.paused && handsInstance.current) {
          await handsInstance.current.send({ image: videoRef.current }); 
        }
      }, 
      width: 640, height: 480 // רזולוציה אופטימלית לחיסכון במשאבים
    });
    cameraInstance.current.start().catch((err: any) => {
      console.error(err);
      setCameraError("Camera initialization failed. Check permissions.");
    });

    const resize = () => {
      if (!containerRef.current || !canvas || !dCanvas) return;
      canvas.width = containerRef.current.clientWidth; canvas.height = containerRef.current.clientHeight;
      dCanvas.width = canvas.width; dCanvas.height = canvas.height;
    };
    window.addEventListener('resize', resize);
    resize();

    return () => {
      isMounted.current = false;
      window.removeEventListener('resize', resize);
      if (cameraInstance.current) { cameraInstance.current.stop(); cameraInstance.current = null; }
      if (handsInstance.current) { handsInstance.current.close(); handsInstance.current = null; }
      if (video && video.srcObject) { (video.srcObject as MediaStream).getTracks().forEach(t => t.stop()); video.srcObject = null; }
    };
  }, [settings, hideUI, isRecording, textLayers, virtualButtons, brushSize, settings.zoomLevel, getHUDCoords, clearCanvas, createNewBoard, takeSnapshot]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!settings.useMouse) return;
    mouseIsDown.current = true;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasRef.current!.width/2) / settings.zoomLevel + canvasRef.current!.width/2;
    const y = (e.clientY - rect.top - canvasRef.current!.height/2) / settings.zoomLevel + canvasRef.current!.height/2;
    lastPoints.current['mouse'] = { x, y };
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
    dctx.lineWidth = brushSize; dctx.lineCap = 'round'; dctx.stroke();
    lastPoints.current['mouse'] = { x, y };
  };

  return (
    <div className="flex flex-col w-full h-screen bg-[#0a0a0a] overflow-hidden dir-rtl">
      <div className="flex flex-1 relative overflow-hidden">
        <div className={`transition-all duration-500 h-full overflow-hidden flex shadow-2xl z-40 ${sidebarOpen ? 'w-[360px]' : 'w-0'} bg-[#151515]`}>
          <div className="w-[360px] flex flex-col h-full border-l border-white/5">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Palette className="w-5 h-5 text-white" /></div>
                <h2 className="text-xl font-bold">Orel Studio</h2>
              </div>
              <button onClick={() => setShowKeyboard(!showKeyboard)} className="p-2 hover:bg-white/5 rounded-lg"><Keyboard size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <label className="text-xs font-bold opacity-50">גודל מכחול: {brushSize}px</label>
                <input type="range" min="1" max="500" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full accent-blue-500" />
              </div>
              <div className="grid grid-cols-6 gap-2">
                {(Object.keys(COLORS) as PaintColor[]).map(c => (
                  <button key={c} onClick={() => { activeColor.current = COLORS[c]; setSelectedColor(c); }} className={`w-full aspect-square rounded-lg border-2 ${selectedColor === c ? 'border-white scale-110' : 'border-transparent opacity-60'}`} style={{ backgroundColor: COLORS[c] }} />
                ))}
              </div>
              <div className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-xs font-bold opacity-50">גלריה</h3>
                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto">
                  {gallery.map((board) => (
                    <div key={board.id} className="aspect-video bg-black/40 rounded-lg border border-white/10 relative overflow-hidden group">
                      <img src={board.dataUrl} className="w-full h-full object-contain" alt="saved" />
                      <div className="absolute inset-0 bg-blue-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                        <button onClick={() => { const img = new Image(); img.onload = () => drawingCanvasRef.current?.getContext('2d')?.drawImage(img, 0, 0); img.src = board.dataUrl; }} className="p-1 bg-white/20 rounded"><Copy size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
                {gallery.length >= 3 && <button onClick={startCheatMode} className="w-full py-2 bg-red-600 rounded-xl font-bold flex items-center justify-center gap-2 animate-pulse"><Zap size={16}/> מצב צ׳יט</button>}
              </div>
            </div>
            <div className="p-6 bg-black/10 border-t border-white/5">
               <button onClick={takeSnapshot} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all"><Camera size={20}/> צילום מהיר</button>
            </div>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 relative h-full bg-black cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => mouseIsDown.current = false} onContextMenu={e => e.preventDefault()}>
          <video ref={videoRef} className="absolute hidden" playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 z-10" />
          <canvas ref={drawingCanvasRef} className="hidden" />

          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`absolute top-6 ${sidebarOpen ? 'left-[340px]' : 'right-6'} z-50 p-3 bg-[#1e1e1e] rounded-full border border-white/10`}>
            {sidebarOpen ? <ChevronLeft/> : <ChevronRight/>}
          </button>

          {loading && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#0a0a0a]">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
          )}

          {cameraError && (
             <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/90 p-8 text-center">
                <div className="max-w-md space-y-6">
                   <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
                   <h2 className="text-2xl font-bold">המצלמה חסומה</h2>
                   <p className="opacity-60">הדפדפן חוסם את הגישה למצלמה. בדוק הרשאות או כבה חוסמי פרסומות.</p>
                   <button onClick={() => window.location.reload()} className="w-full py-3 bg-red-500 rounded-xl font-bold">נסה שוב</button>
                </div>
             </div>
          )}

          {countdown !== null && <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 text-[12rem] font-black">{countdown}</div>}

          {showKeyboard && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e]/95 p-4 rounded-2xl border border-white/10 flex gap-3 animate-in slide-in-from-bottom">
              <input autoFocus type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="הקלד כאן..." className="bg-black/50 p-2 rounded-lg text-white" />
              <button onClick={() => { setTextLayers([...textLayers, { id: Date.now().toString(), text: inputText, x: canvasRef.current!.width/2, y: canvasRef.current!.height/2, color: activeColor.current, size: brushSize*3 }]); setShowKeyboard(false); }} className="p-2 bg-blue-600 rounded-lg"><CheckCircle2 size={16}/></button>
            </div>
          )}

          {capturedImage && (
            <div className="absolute inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 backdrop-blur-2xl">
              <div className="max-w-3xl w-full bg-[#1e1e1e] rounded-[40px] overflow-hidden border border-white/10 p-8 text-center space-y-6">
                <img src={capturedImage} className="max-h-[60vh] mx-auto rounded-2xl" alt="Captured" />
                <div className="flex gap-4">
                  <button onClick={() => { const a = document.createElement('a'); a.href = capturedImage; a.download = "art.png"; a.click(); }} className="flex-1 py-4 bg-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2"><Download size={20} /> שמור</button>
                  <button onClick={() => setCapturedImage(null)} className="flex-1 py-4 bg-white/5 rounded-2xl font-bold">חזור</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <footer className="bg-[#121212] border-t border-white/5 py-4 px-8 text-xs opacity-50 flex justify-between">
        <span>Orel Gold © 2026</span>
        <div className="flex gap-4">
          <a href="https://linktr.ee/orel_7" target="_blank">מרכז קישורים</a>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLScf_p-paTd_NyDySZ6lgfDUaGdoMc0nEo_MQ3w2sPtsplXOrw/viewform" target="_blank">צור קשר</a>
        </div>
      </footer>
    </div>
  );
};

export default GeminiPainter;