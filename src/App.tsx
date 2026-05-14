import { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAgent } from './hooks/useAgent';
import { auth, getFirebase } from './services/firebaseService';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { OrbitControls, Grid, PerspectiveCamera, Environment, Stars } from '@react-three/drei';
import { motion } from 'framer-motion';
import { 
  Bot, 
  Cpu, 
  Globe, 
  Layers, 
  Play, 
  MessageSquare, 
  Terminal, 
  Settings,
  ChevronRight,
  Database,
  Activity,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  LogIn,
  LogOut,
  XCircle,
  User as UserIcon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Panel = ({ title, icon: Icon, children, className }: any) => (
  <div className={cn("bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col", className)}>
    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-indigo-500" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</h3>
      </div>
      <div className="flex gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
      </div>
    </div>
    <div className="flex-1 overflow-auto p-4 text-slate-900">
      {children}
    </div>
  </div>
);

const RobotModel = ({ position = [0, 0, 0], isSimulating = false }: any) => {
  return (
    <group position={position}>
      {/* Basic Robot Representation */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.5, 1, 0.3]} />
        <meshStandardMaterial color={isSimulating ? "#4466ff" : "#333"} roughness={0.1} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <sphereGeometry args={[0.2]} />
        <meshStandardMaterial color="#555" emissive={isSimulating ? "#00ffff" : "#0077ff"} emissiveIntensity={0.5} />
      </mesh>
      {/* Arms */}
      <group rotation={[isSimulating ? 0.5 : 0, 0, 0]}>
        <mesh position={[0.35, 0.7, 0]} castShadow>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      </group>
      <group rotation={[isSimulating ? -0.5 : 0, 0, 0]}>
        <mesh position={[-0.35, 0.7, 0]} castShadow>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      </group>

      {/* Connection lines if simulating */}
      {isSimulating && (
        <mesh position={[0, 2, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 2]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
};

export default function App() {
  const { processCommand, stopProcess, isProcessing: isAgentProcessing } = useAgent();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [activeStep, setActiveStep] = useState(0); 
  const [logs, setLogs] = useState<string[]>(["System initialized. Waiting for input..."]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // --- World Model State ---
  const [robotPos, setRobotPos] = useState<[number, number, number]>([0, 0, 0]);
  const [isCarrying, setIsCarrying] = useState(false);
  const [cupPos, setCupPos] = useState<[number, number, number]>([2, 0.25, 1]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    getFirebase().then(() => {
      if (!auth) {
        setIsAuthReady(true);
        return;
      }
      
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setIsAuthReady(true);
        if (u) addLog(`User authenticated: ${u.email}`);
      });
    });

    return () => unsubscribe?.();
  }, []);

  const handleLogin = async () => {
    await getFirebase();
    if (!auth) return;
    try {
      addLog("Initiating authorization...");
      const provider = new GoogleAuthProvider();
      // Ensure persistence is set
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error("Login Error:", e);
      addLog(`Login failed: ${e.message}`);
    }
  };

  const handleLogout = () => auth?.signOut();
  
  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-15), `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleAbort = () => {
    stopProcess();
    addLog("OPERATOR_INTERVENTION: Kill signal sent to Agent Core.");
  };

  const handleSend = async () => {
    if (!input) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    const currentInput = input;
    setInput("");
    
    addLog(`Received command: ${currentInput}`);
    
    const result = await processCommand(
      currentInput, 
      `Robot at (${robotPos.join(',')}). Red cup at (${cupPos.join(',')}). Simulation table at (2,0,1).`, 
      (msg, step) => {
        addLog(msg);
        setActiveStep(step);
      },
      (action) => {
        // Simple heuristic for visual simulation
        const desc = action.description.toLowerCase();
        if (desc.includes("move") || desc.includes("go to") || desc.includes("navigate")) {
          if (desc.includes("cup") || desc.includes("red")) {
            setRobotPos([1.5, 0, 0.8]); 
          } else if (desc.includes("other") || desc.includes("table") || desc.includes("destination") || desc.includes("(-2")) {
            setRobotPos([-1.5, 0, -1.8]); 
          } else {
            setRobotPos([0, 0, 0]); 
          }
        }
        if (desc.includes("pick") || desc.includes("take") || desc.includes("grasp") || desc.includes("lift")) {
          addLog("AGENT: Actuating end-effector...");
          setIsCarrying(true);
        }
        if (desc.includes("place") || desc.includes("put") || desc.includes("drop")) {
          addLog("AGENT: Releasing object...");
          setIsCarrying(false);
          setCupPos([robotPos[0] + 0.5, 0.25, robotPos[2] + 0.2]);
        }
      }
    );

    if (result.success) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Task executed successfully in both virtual and physical environments." }]);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: "Task failed during simulation. Please refine the instruction." }]);
    }
    
    setActiveStep(0);
  };

  // Sync cup position with robot if carrying
  const effectiveCupPos: [number, number, number] = isCarrying 
    ? [robotPos[0], robotPos[1] + 1.2, robotPos[2] + 0.3] // Parent to robot's "arm" height
    : cupPos;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shadow-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded shadow-lg flex items-center justify-center font-bold text-white">Ω</div>
          <div>
            <h1 className="text-sm font-bold tracking-tight uppercase tracking-widest text-slate-900">EonLink <span className="text-indigo-600">OS</span></h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Embodied Intelligence Control System</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
            <Cpu className="w-3 h-3 text-indigo-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
              Engine: {!!import.meta.env.VITE_NVIDIA_API_KEY ? "NVIDIA NIM" : "Gemini 2.0"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-900 leading-none">{user.displayName || 'Operator'}</span>
                  <span className="text-[8px] text-slate-500 uppercase tracking-tighter">Auth: Level 4</span>
                </div>
                <button onClick={handleLogout} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-slate-900" title="Sign Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md shadow hover:bg-slate-800 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Authorize</span>
              </button>
            )}
            
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Optimal</span>
            </div>

            {isAgentProcessing && (
              <button 
                onClick={handleAbort}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
              >
                <XCircle className="w-3 h-3 text-rose-500" />
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tighter">Kill Process</span>
              </button>
            )}
          </div>
          <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Left Column: UI & Agent Logic */}
        <div className="w-1/3 flex flex-col gap-4">
          {/* User Interaction Layer */}
          <Panel title="User Interaction" icon={MessageSquare} className="flex-1">
            <div className="flex flex-col h-full gap-4">
              <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <MessageSquare className="w-12 h-12 mb-4" />
                    <p className="text-sm">Initiate command sequence...</p>
                    <p className="text-xs mt-2 italic px-8">"Go to the table and fetch the red cup"</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-lg text-sm max-w-[90%]",
                    m.role === 'user' ? "ml-auto bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-slate-50 border border-slate-100"
                  )}>
                    {m.content}
                  </div>
                ))}
              </div>
              <div className="relative">
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Enter operation command..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
                <button 
                  onClick={handleSend}
                  disabled={isAgentProcessing}
                  className="absolute right-2 top-1.5 p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {isAgentProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </Panel>

          {/* Agent reasoning / Logic Chain */}
          <Panel title="Agent Core Pipeline" icon={Cpu} className="h-64">
            <div className="space-y-4">
              {[
                { id: 1, label: "Task Decomposition", desc: "MLLM Semantic Analysis", icon: Layers },
                { id: 2, label: "World Simulation", desc: "Physical Consistency Check", icon: Globe },
                { id: 3, label: "Robotics Interface", desc: "Sim2Real Action Execution", icon: Bot }
              ].map((step) => (
                <div key={step.id} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all duration-300",
                  activeStep === step.id 
                    ? "bg-indigo-50 border-indigo-200 translate-x-2" 
                    : "bg-slate-50 border-slate-100 opacity-50"
                )}>
                  <div className={cn(
                    "p-2 rounded-md",
                    activeStep === step.id ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                  )}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-tight leading-none text-slate-800">{step.label}</h4>
                    <p className="text-[9px] text-slate-500 mt-1">{step.desc}</p>
                  </div>
                  {activeStep === step.id && (
                    <div className="ml-auto">
                      <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Center: 3D Visualization / Simulation */}
        <div className="flex-1 flex flex-col gap-4">
          <Panel title="World Model Visualization" icon={Globe} className="flex-1 relative">
            <div className="absolute inset-0 z-0">
              <Canvas shadows>
                <PerspectiveCamera makeDefault position={[5, 5, 5]} />
                <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.1} />
                
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                
                <ambientLight intensity={0.8} />
                <hemisphereLight intensity={0.5} groundColor="#000000" />
                <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
                
                <Grid 
                  infiniteGrid 
                  fadeDistance={30} 
                  sectionSize={1.5} 
                  sectionThickness={1} 
                  sectionColor="#cbd5e1" 
                  cellSize={0.5} 
                  cellColor="#e2e8f0" 
                />
                
                <RobotModel 
                  position={robotPos} 
                  isSimulating={activeStep === 2} 
                />
                
                {/* Simulated Objects */}
                <group position={effectiveCupPos}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.15, 0.12, 0.4, 32]} />
                    <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.2} />
                  </mesh>
                  <mesh position={[0, 0.2, 0.2]} castShadow rotation={[Math.PI/2, 0, 0]}>
                     <torusGeometry args={[0.08, 0.02, 16, 100, Math.PI]} />
                     <meshStandardMaterial color="#ef4444" />
                  </mesh>
                </group>
                
                {/* Tables */}
                <group position={[2, 0.05, 1]}>
                  <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                    <circleGeometry args={[1]} />
                    <meshStandardMaterial color="#6366f1" opacity={0.1} transparent />
                  </mesh>
                  <mesh position={[0, -0.05, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 0.1, 32]} />
                    <meshStandardMaterial color="#cbd5e1" />
                  </mesh>
                </group>

                <group position={[-2, 0.05, -2]}>
                  <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                    <circleGeometry args={[1]} />
                    <meshStandardMaterial color="#6366f1" opacity={0.1} transparent />
                  </mesh>
                  <mesh position={[0, -0.05, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 0.1, 32]} />
                    <meshStandardMaterial color="#cbd5e1" />
                  </mesh>
                </group>
              </Canvas>
            </div>
            
            {/* Viewport HUD */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <div className="px-2 py-1 rounded bg-white/80 backdrop-blur border border-slate-200 text-[10px] font-mono text-slate-500 shadow-sm">
                FPS: 60
              </div>
              <div className="px-2 py-1 rounded bg-white/80 backdrop-blur border border-slate-200 text-[10px] font-mono text-slate-500 shadow-sm">
                LATENCY: 12ms
              </div>
            </div>
            
            <div className="absolute bottom-4 left-4 flex gap-4">
               <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 backdrop-blur border border-slate-200 shadow-sm">
                 <Database className="w-4 h-4 text-indigo-500" />
                 <div className="flex flex-col">
                   <span className="text-[8px] uppercase text-slate-400 font-bold tracking-tight">Skill Matrix</span>
                   <span className="text-[10px] font-bold text-slate-900 italic">128 ACTIVE NODES</span>
                 </div>
               </div>
            </div>
          </Panel>

          {/* Lower Terminal */}
          <Panel title="System Logs & Telemetry" icon={Terminal} className="h-48">
            <div className="font-mono text-[10px] space-y-1 bg-slate-900 p-3 rounded-lg text-slate-300 h-full overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className={cn(
                  "flex gap-4 p-0.5 rounded",
                  log.includes("error") ? "text-rose-400" : "text-slate-400"
                )}>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right Column: Status & Skill Lib */}
        <div className="w-80 flex flex-col gap-4">
          <Panel title="Hardware Status" icon={Activity} className="h-1/2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">CPU Usage</span>
                <span className="text-xs text-indigo-600 font-bold">24%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="w-[24%] h-full bg-amber-400" />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Storage Capacity</span>
                <span className="text-xs text-slate-900 font-bold tracking-tight italic">18.4GB</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="w-[88%] h-full bg-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-6">
                 {[
                  { label: "Joint 1", val: "+12.4°", status: "ok" },
                  { label: "Joint 2", val: "-45.1°", status: "ok" },
                  { label: "Joint 3", val: "+0.2°", status: "warn" },
                  { label: "Joint 4", val: "+88.9°", status: "ok" }
                 ].map(s => (
                   <div key={s.label} className="px-3 py-2 border border-slate-100 rounded bg-slate-50 shadow-sm">
                      <div className="text-[8px] font-bold uppercase text-slate-400">{s.label}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-bold text-slate-900">{s.val}</span>
                        <div className={cn("w-2 h-2 rounded-full", s.status === 'ok' ? "bg-emerald-500" : "bg-amber-400")} />
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          </Panel>

          <Panel title="Skill Library" icon={Database} className="flex-1">
            <div className="space-y-1">
              {[
                "Navigate_to_Kitchen",
                "Pick_up_Object",
                "Place_Object",
                "Detect_Obstacle",
                "Door_Operation",
                "Human_Detection",
                "Visual_Servo_Task"
              ].map(skill => (
                <div key={skill} className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors rounded-md group">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{skill}</span>
                  <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
              <button className="w-full mt-4 py-2 border border-dashed border-slate-200 rounded text-[9px] uppercase font-bold tracking-widest text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                + Expand protocols
              </button>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
