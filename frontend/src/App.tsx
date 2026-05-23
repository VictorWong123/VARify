import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  Upload, 
  Activity, 
  HelpCircle, 
  Play, 
  Video, 
  AlertTriangle, 
  CheckCircle, 
  Check, 
  Clock, 
  Flame, 
  AlertCircle,
  Database,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { DecisionType, RuleCategoryType, VARifyResult } from './types';

// Let's create beautiful pre-configured mock data for the 3 presets to guarantee snappy loading and instant results for those!
const presets = [
  {
    id: 'late-tackle',
    title: 'Late Sliding Tackle',
    subtitle: 'Classic reckless challenge',
    videoLabel: 'Premier League Match excerpt',
    result: {
      decision: 'YELLOW_CARD' as DecisionType,
      confidence: 82,
      keyTimestamp: '00:07-00:09',
      ruleCategory: 'reckless' as RuleCategoryType,
      explanation: 'The tackle is deemed reckless. The defender attempts a sliding challenge but arrives completely late, making no contact with the ball while sweeping the opponent\'s lower leg. Under IFAB Law 12, this challenge shows a complete disregard for the danger and consequences to the opponent.',
      evidence: [
        { timestamp: '00:07', description: 'Defender commits to a ground slide as the attacker knocks the ball forward.' },
        { timestamp: '00:08', description: 'Defender misses the ball entirely, creating an unavoidable obstacle.' },
        { timestamp: '00:09', description: 'Severe contact made to the lower leg, sweep-tripping the attacker.' }
      ],
      geminiSummary: 'A fast-paced ground challenge where the defender slides late and wipes out the attacking midfielder on the ankle joint.',
      modelTrace: {
        videoAnalyzer: 'Gemini 3.5 Flash',
        orchestrator: 'RocketRide Orchestration',
        decisionModel: 'Gemma-9B on GMI Cloud'
      }
    }
  },
  {
    id: 'excessive-force',
    title: 'Studs-up Lunging Tackle',
    subtitle: 'Dangerous excessive force',
    videoLabel: 'Champions League simulation',
    result: {
      decision: 'RED_CARD' as DecisionType,
      confidence: 94,
      keyTimestamp: '00:03-00:05',
      ruleCategory: 'excessive force' as RuleCategoryType,
      explanation: 'Red Card offense of Serious Foul Play. The defender launches into a high-speed challenge with their foot off the ground, studs fully exposed, and strikes the opponent straight in the shin above the ankle. The action far exceeds the necessary use of force and directly endangers the physical safety of the opponent.',
      evidence: [
        { timestamp: '00:03', description: 'Defender lunges forward, leaving the feet and elevating their leg.' },
        { timestamp: '00:04', description: 'Studs are fully exposed facing the opponent’s shin.' },
        { timestamp: '00:05', description: 'High-impact contact high above the boot; shin guard absorbs the crushing force.' }
      ],
      geminiSummary: 'A dangerous aerial lunge with studs showing that connects directly with the opponent\'s lower shin with high velocity.',
      modelTrace: {
        videoAnalyzer: 'Gemini 3.5 Flash',
        orchestrator: 'RocketRide Orchestration',
        decisionModel: 'Gemma-9B on GMI Cloud'
      }
    }
  },
  {
    id: 'clean-charge',
    title: 'Shoulder Challenge & Poke',
    subtitle: 'Excellent fair sliding tackle',
    videoLabel: 'La Liga incident review',
    result: {
      decision: 'NO_CARD' as DecisionType,
      confidence: 91,
      keyTimestamp: '00:11-00:13',
      ruleCategory: 'no offense' as RuleCategoryType,
      explanation: 'No offense committed. The challenge is a textbook fair physical duel. Both players move parallel battling for the loose ball. The defender initiates minimal shoulder-to-shoulder contact, keeps their arms locked close, and cleanly pokes the ball away before any contact with the player.',
      evidence: [
        { timestamp: '00:11', description: 'Defender sprint parallel to attacker, jockeying for space.' },
        { timestamp: '00:12', description: 'Fair shoulder-to-shoulder leverage without backing or shoving.' },
        { timestamp: '00:13', description: 'Defender executes a precise poke tackle, knocking the ball away cleanly.' }
      ],
      geminiSummary: 'Excellent mutual leverage side-by-side where the defender plays the ball first with a clean interception.',
      modelTrace: {
        videoAnalyzer: 'Gemini 3.5 Flash',
        orchestrator: 'RocketRide Orchestration',
        decisionModel: 'Gemma-9B on GMI Cloud'
      }
    }
  }
];

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [result, setResult] = useState<VARifyResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Status updates simulation during load
  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setPipelineStep(0);
      interval = setInterval(() => {
        setPipelineStep((prev) => {
          if (prev >= 3) {
            clearInterval(interval);
            return 3;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setPipelineStep(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Clean preview URL when state changes
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setActivePreset(null);
      setResult(null);
      setErrorMessage(null);
      
      // Revoke old URL
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const selectPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setActivePreset(presetId);
      setSelectedFile(null);
      setResult(null);
      setErrorMessage(null);
      setVideoPreviewUrl(null); // Clear manual video
    }
  };

  const triggerAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    // If active preset is chosen, we can bypass file uploading and deliver a fast highly computed mock for instant demo!
    if (activePreset) {
      try {
        const formData = new FormData();
        formData.append('demoId', activePreset);

        const response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('API server returned error status.');
        }

        const data: VARifyResult = await response.json();
        setResult(data);
      } catch (err: any) {
        console.warn('Backend failed, serving preset data instantly as frontend backup.', err);
        const preset = presets.find((p) => p.id === activePreset);
        if (preset) {
          setResult(preset.result);
        }
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please upload a soccer video clip or select a preset review scenario.');
      setIsAnalyzing(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to obtain a logical response from GMI Cloud / Gemini backend.');
      }

      const data: VARifyResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while contacting GMI Cloud and Gemini backend services.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Convert "00:07" or "00:07-00:09" into a seekable seconds float
  const seekToTimestamp = (timestampString: string) => {
    if (!videoRef.current) return;
    
    // Extract first timestamp if a range is given
    const singularPart = timestampString.split('-')[0].trim();
    const parts = singularPart.split(':');
    
    let seconds = 0;
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      seconds = mins * 60 + secs;
    } else if (parts.length === 1) {
      seconds = parseInt(parts[0], 10);
    }

    if (!isNaN(seconds)) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 pb-12">
      {/* Upper Tech Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-4 py-3" id="main-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-green-400 p-2 rounded-lg text-slate-950 font-bold tracking-tighter flex items-center shadow-lg shadow-emerald-500/10">
              <Shield className="w-5 h-5 mr-1" />
              <span>VAR</span>
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-white flex items-center">
                VARify <span className="ml-2 text-xs font-mono uppercase text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded bg-emerald-500/10">MVP Pipeline</span>
              </h1>
              <p className="text-slate-400 text-xs font-medium">AI Referee Assistant for Card Sanctions</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="hidden md:flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-full px-3 py-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Express + Spring Boot Engine Ready</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8" id="main-container">
        
        {/* Left Side: Upload constraints & Presets */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Preset scenarios block */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl" id="preset-selector-card">
            <div className="flex items-center space-x-2 mb-4">
              <Flame className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-200">1. Select Preset VAR Review (Swift Demo)</h2>
            </div>
            
            <p className="text-slate-400 text-xs mb-4 leading-relaxed">
              No local video? Instantly experience the 3-step AI referee pipeline with standard soccer match incidents:
            </p>

            <div className="space-y-3">
              {presets.map((p) => {
                const isActive = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    id={`preset-btn-${p.id}`}
                    onClick={() => selectPreset(p.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all duration-200 flex items-start justify-between ${
                      isActive 
                        ? 'bg-slate-800/80 border-emerald-500/60 shadow-lg shadow-emerald-500/5' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm text-slate-100">{p.title}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          p.result.decision === 'RED_CARD' 
                            ? 'bg-red-500/20 text-red-400' 
                            : p.result.decision === 'YELLOW_CARD'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-700/30 text-slate-400'
                        }`}>
                          {p.result.decision === 'RED_CARD' ? 'RED' : p.result.decision === 'YELLOW_CARD' ? 'YELLOW' : 'PLAY-ON'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{p.subtitle}</p>
                    </div>
                    {isActive && (
                      <div className="bg-emerald-500/20 text-emerald-400 p-1 rounded-full border border-emerald-500/30">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual File Uploader */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl" id="video-upload-card">
            <div className="flex items-center space-x-2 mb-4">
              <Video className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-200">OR: Upload Custom Soccer Recording</h2>
            </div>

            <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 bg-slate-950/40 hover:bg-slate-950 transition-colors flex flex-col items-center justify-center text-center group cursor-pointer relative">
              <input 
                type="file" 
                id="file-upload-input"
                accept="video/mp4,video/quicktime,video/webm" 
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 transition-colors mb-3" />
              
              {selectedFile ? (
                <div className="space-y-1 z-25 max-w-xs">
                  <p className="font-semibold text-sm text-slate-200 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace file</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium text-sm text-slate-300">Drag & drop your soccer clip here</p>
                  <p className="text-xs text-slate-500">Accepts MP4, MOV or WEBM (Max 30MB)</p>
                </div>
              )}
            </div>

            {/* Video preview monitor */}
            {videoPreviewUrl && (
              <div className="mt-5 border border-slate-800 rounded-lg p-2 bg-slate-950" id="video-monitor-preview-container">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between px-1">
                  <span>⚽ Custom Clip Selected</span>
                  <span className="text-emerald-500 animate-pulse">● Source Connected</span>
                </div>
                <video 
                  ref={videoRef}
                  src={videoPreviewUrl} 
                  controls 
                  className="w-full rounded bg-black max-h-56 object-contain"
                />
              </div>
            )}
            
            {/* If preset is selected, show an simulated static monitor for context */}
            {activePreset && (
              <div className="mt-5 border border-slate-800 rounded-lg p-2 bg-slate-950" id="preset-monitor-container">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between px-1">
                  <span>⚽ Preset Simulation Stream</span>
                  <span className="text-blue-400">● Active</span>
                </div>
                <div className="h-44 bg-slate-900 rounded flex flex-col items-center justify-center text-center relative overflow-hidden border border-slate-800">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                  <Video className="w-10 h-10 text-slate-700 mb-2 relative z-20" />
                  <p className="text-xs font-semibold text-slate-300 relative z-20">
                    {presets.find((p) => p.id === activePreset)?.title}
                  </p>
                  <p className="text-[10px] text-slate-500 relative z-20">
                    {presets.find((p) => p.id === activePreset)?.videoLabel}
                  </p>
                  <div className="absolute top-2 right-2 bg-emerald-500/10 border border-emerald-500/30 text-[9px] text-emerald-400 rounded px-1.5 font-mono z-20">
                    MOCKED
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Analyze CTA button */}
          <button
            onClick={triggerAnalysis}
            disabled={isAnalyzing || (!selectedFile && !activePreset)}
            id="analyze-pipeline-cta-btn"
            className="w-full py-4 px-6 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-green-500 text-slate-950 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 shadow-xl shadow-emerald-500/10 flex items-center justify-center text-base"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                <span>Running Intelligence Pipeline...</span>
              </>
            ) : (
              <>
                <Activity className="w-5 h-5 mr-2" />
                <span>Analyze Clip via VARify Pipeline</span>
              </>
            )}
          </button>

          {/* Error logger */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs flex items-start space-x-2" id="error-box">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="font-bold block mb-1">Pipeline Fault Detected</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Pipeline trace tracker during analysis */}
          {isAnalyzing && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-400 space-y-2" id="orchestration-trace-card">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-slate-300">
                <span className="font-bold flex items-center"><Cpu className="w-4 h-4 mr-1.5 text-emerald-400" /> Pipeline Orchestration</span>
                <span className="text-[10px] text-emerald-400 animate-pulse">ACTIVE</span>
              </div>
              <div className="space-y-2">
                <div className={`flex items-center space-x-2 ${pipelineStep >= 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {pipelineStep > 0 ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700 animate-spin"></div>}
                  <span>Step 1: Gemini reading video telemetry...</span>
                </div>
                <div className={`flex items-center space-x-2 ${pipelineStep >= 1 ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {pipelineStep > 1 ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : pipelineStep === 1 ? <div className="w-3.5 h-3.5 rounded-full border border-slate-700 animate-spin"></div> : <div className="w-3.5 h-3.5 rounded-full border border-slate-800"></div>}
                  <span>Step 2: Structuring incident report...</span>
                </div>
                <div className={`flex items-center space-x-2 ${pipelineStep >= 2 ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {pipelineStep > 2 ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : pipelineStep === 2 ? <div className="w-3.5 h-3.5 rounded-full border border-slate-700 animate-spin"></div> : <div className="w-3.5 h-3.5 rounded-full border border-slate-800"></div>}
                  <span>Step 3: GMI Cloud Gemma evaluating contact severity...</span>
                </div>
                <div className={`flex items-center space-x-2 ${pipelineStep >= 3 ? 'text-teal-400' : 'text-slate-600'}`}>
                  {pipelineStep === 3 ? <div className="w-3.5 h-3.5 rounded-full border border-slate-700 animate-spin"></div> : <div className="w-3.5 h-3.5 rounded-full border border-slate-800"></div>}
                  <span>Step 4: Compiling visual evidence and rendering...</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Results Monitor Dashboard */}
        <div className="lg:col-span-7">
          
          {/* Default blank placeholder */}
          {!result && !isAnalyzing && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[500px]" id="no-result-placeholder">
              <Shield className="w-16 h-16 text-slate-700 mb-4 animate-pulse" />
              <h3 className="font-bold text-lg text-slate-300">Awaiting Incident Video</h3>
              <p className="text-slate-500 text-sm max-w-sm mt-2 leading-relaxed">
                Choose a preconfigured scenario from the list or upload an MP4 clip, then click <strong className="text-emerald-400">Analyze Clip</strong> to verify the card decision.
              </p>
              
              <div className="mt-8 border border-slate-800/60 rounded-xl p-4 bg-slate-950/40 text-left max-w-md">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block mb-1">FIFA VAR Rule Protocol</span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Decisions are generated based on IFAB Law 12 guidelines analyzing natural speed, studs visibility, trailing point leg force, and playability of the ball first.
                </p>
              </div>
            </div>
          )}

          {/* Loader Overlay */}
          {isAnalyzing && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center min-h-[500px] text-center" id="loading-overlay">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-emerald-400 animate-spin"></div>
                <Activity className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <h3 className="font-bold text-lg text-slate-200 animate-pulse">VAR Review in Progress</h3>
              <p className="text-slate-500 text-sm max-w-xs mt-2">
                AI referee pipeline is reviewing safety thresholds, studs heights, and tackle speed. Please stay online.
              </p>
            </div>
          )}

          {/* Results dashboard block */}
          {result && !isAnalyzing && (
            <div className="space-y-6 animate-fadeIn" id="results-dashboard-root">
              
              {/* Card Official Decision Banner */}
              <div className={`border rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                result.decision === 'RED_CARD' 
                  ? 'bg-red-950/20 border-red-500/50 text-red-100 shadow-xl shadow-red-500/5' 
                  : result.decision === 'YELLOW_CARD'
                  ? 'bg-amber-950/20 border-amber-500/50 text-amber-100 shadow-xl shadow-amber-500/5'
                  : 'bg-slate-800/40 border-slate-700 text-slate-100'
              }`} id="card-decision-banner">
                
                {/* Visual Card Accent */}
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-18 rounded-md shadow-2xl transition-transform transform hover:scale-105 ${
                    result.decision === 'RED_CARD' 
                      ? 'bg-gradient-to-tr from-red-600 to-red-500 outline outline-ffr text-white shadow-red-600/40' 
                      : result.decision === 'YELLOW_CARD'
                      ? 'bg-gradient-to-tr from-yellow-500 to-amber-400 text-slate-950 shadow-yellow-500/40'
                      : 'bg-slate-700 border border-slate-600 text-slate-400 shadow-slate-900/40'
                  } flex items-center justify-center font-black text-[10px] uppercase font-mono tracking-tighter`} style={{ height: '70px', width: '48px' }}>
                    VAR
                  </div>
                  <div>
                    <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">Official Decision</span>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-0.5">
                      {result.decision === 'RED_CARD' && '🔴 RED CARD'}
                      {result.decision === 'YELLOW_CARD' && '🟡 YELLOW CARD'}
                      {result.decision === 'NO_CARD' && '⚪ NO CARD / PLAY ON'}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Rule Verdict Category: <strong className="bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800 text-emerald-400 lowercase">{result.ruleCategory}</strong>
                    </p>
                  </div>
                </div>

                {/* Score panel */}
                <div className="md:text-right border-t md:border-t-0 md:border-l border-slate-800 md:pl-6 pt-4 md:pt-0 flex md:flex-col justify-between items-center md:items-end">
                  <span className="text-xs font-mono text-slate-400">Confidence Match</span>
                  <div className="flex items-baseline space-x-1 mt-1">
                    <span className="text-3xl font-black text-white">{result.confidence}%</span>
                  </div>
                </div>
              </div>

              {/* Referee Explanation and Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6" id="explanation-card">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300 mb-3 border-b border-slate-800 pb-2">
                  Technical Decision Explanation
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed text-slate-200">
                  {result.explanation}
                </p>
              </div>

              {/* Interactive Video Timeline Evidence */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6" id="evidence-timeline-card">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300 flex items-center">
                    <Clock className="w-4 h-4 mr-1.5 text-emerald-400" /> Ground Evidence Review
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">Click time to seek video</span>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {result.evidence.map((ev, index) => (
                    <div key={index} className="relative group">
                      
                      {/* Timeline dot */}
                      <div className="absolute -left-7 top-1.5 w-3 h-3 rounded-full border-2 border-slate-900 bg-emerald-500 group-hover:bg-emerald-400 transition-colors z-20"></div>
                      
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-1.5">
                        <div className="space-y-1">
                          <button
                            onClick={() => seekToTimestamp(ev.timestamp)}
                            id={`seek-btn-${index}`}
                            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded flex items-center transition-colors float-left mr-2.5"
                          >
                            <Play className="w-2.5 h-2.5 mr-1 text-emerald-400 fill-emerald-400" />
                            {ev.timestamp}
                          </button>
                          <p className="text-slate-300 text-sm">{ev.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual Report Summary from Gemini */}
              {result.geminiSummary && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5" id="gemini-summary-card">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
                    Step 1: Gemini Visual Extraction
                  </span>
                  <p className="text-xs text-slate-400 italic">
                    "{result.geminiSummary}"
                  </p>
                </div>
              )}

              {/* System trace diagnostics */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3" id="diagnostics-log-card">
                <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  <span>Integrated AI Architecture (Model Trace)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg text-center">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-0.5">1. Video Analysis</span>
                    <strong className="text-xs text-slate-300 block">{result.modelTrace?.videoAnalyzer || 'Gemini 3.5 Flash'}</strong>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg text-center">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-0.5">2. Pipeline Core</span>
                    <strong className="text-xs text-slate-300 block">{result.modelTrace?.orchestrator || 'RocketRide Service'}</strong>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg text-center">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-0.5">3. Sanction Logic</span>
                    <strong className="text-xs text-slate-300 block">{result.modelTrace?.decisionModel || 'Gemma on GMI Cloud'}</strong>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Rules Explainer Panel */}
      <section className="max-w-7xl mx-auto px-4 mt-12" id="rules-reference">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center space-x-2 mb-4 border-b border-slate-800 pb-3">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-base text-slate-200">IFAB LAW 12: Referee Card Guidelines Quick Reference</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-400">
            <div className="space-y-2 border-r border-slate-800/50 pr-4">
              <strong className="text-sm font-semibold text-slate-300 flex items-center">
                <span className="w-2 h-2 rounded-full bg-slate-500 mr-2"></span>
                Careless Tackle (No Card)
              </strong>
              <p className="leading-relaxed">
                The player shows a lack of attention or consideration when making a challenge, or acts without precaution. No disciplinary sanction (card) is needed. Simple direct free kick is awarded.
              </p>
            </div>
            <div className="space-y-2 border-r border-slate-800/50 pr-4">
              <strong className="text-sm font-semibold text-amber-400 flex items-center">
                <span className="w-2 h-2 rounded-full bg-amber-400 mr-2"></span>
                Reckless Challenge (Yellow Card)
              </strong>
              <p className="leading-relaxed">
                The player acts with complete disregard to the danger to, or consequences for, an opponent. A cautionsary sanction (Yellow Card) is mandatory. Examples include late lunges or hard sliding tackles with no ball contact.
              </p>
            </div>
            <div className="space-y-2">
              <strong className="text-sm font-semibold text-red-500 flex items-center">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                Excessive Force (Red Card)
              </strong>
              <p className="leading-relaxed">
                The player far exceeds the necessary use of force and endangers the safety of an opponent. Serious Foul Play threshold is met. Direct Red Card is mandatory. Examples: studs-high impacts, excessive speed, or two-footed off-ground challenges.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
