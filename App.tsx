/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import GeminiPainter from './components/GeminiPainter';
import GeminiSlingshot from './components/GeminiSlingshot';

const App: React.FC = () => {
  const [mode, setMode] = useState<'painter' | 'slingshot'>('painter');

  return (
    <div className="w-full h-full relative overflow-hidden">
      {mode === 'painter' ? <GeminiPainter /> : <GeminiSlingshot />}
      
      {/* Mode Switcher Button - Floating */}
      <div className="fixed bottom-6 right-6 z-[100] group">
        <button 
          onClick={() => setMode(mode === 'painter' ? 'slingshot' : 'painter')}
          className="bg-[#1e1e1e] hover:bg-blue-600 text-white p-4 rounded-2xl shadow-2xl border border-white/10 transition-all duration-300 flex items-center gap-3 active:scale-95"
        >
          {mode === 'painter' ? (
            <>
              <span className="font-bold text-sm hidden group-hover:block transition-all">עבור למשחק Slingshot</span>
              <div className="w-6 h-6 bg-red-500 rounded-full shadow-[0_0_10px_red]" />
            </>
          ) : (
            <>
              <span className="font-bold text-sm hidden group-hover:block transition-all">חזרה לסטודיו ציור</span>
              <div className="w-6 h-6 bg-blue-500 rounded-lg shadow-[0_0_10px_blue] flex items-center justify-center">🎨</div>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default App;