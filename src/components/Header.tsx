import React from "react";
import { Mic, Radio, Layers, Volume2, CloudLightning } from "lucide-react";

interface HeaderProps {
  readyVoicesCount: number;
  trainingCount: number;
}

export default function Header({ readyVoicesCount, trainingCount }: HeaderProps) {
  return (
    <header 
      id="app-header" 
      className="border-b border-slate-200 bg-white sticky top-0 z-40 px-4 py-3 sm:px-6 transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 shadow-sm">
            <Mic className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 font-display flex items-center gap-2">
              VoiceClone <span className="text-indigo-600">Studio</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Studio Edition</p>
          </div>
        </div>

        {/* Real-time Status tags */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Library:</span>
            <span className="font-semibold text-slate-900">{readyVoicesCount} Ready</span>
          </div>

          {trainingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-mono text-indigo-700 animate-pulse">
              <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span>Training:</span>
              <span className="font-semibold text-indigo-900">{trainingCount} Active</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span>Gemini TTS Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}
