import { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAgent } from './hooks/useAgent';
import { identifyObjects, type DetectedObject } from './services/perceptionService';
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
  Eye,
  Camera,
  Scan,
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

const SmoothGroup = ({ position = [0, 0, 0], children, ...props }: any) => {
  const ref = useRef<THREE.Group>(null!);
  const targetPos = useRef(new THREE.Vector3(...position));
  const [lastTime, setLastTime] = useState(0);
  const FPS = 30;
  const interval = 1000 / FPS;

  useEffect(() => {
    targetPos.current.set(position[0], position[1], position[2]);
  }, [position]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime() * 1000;
    if (time - lastTime >= interval) {
      ref.current.position.lerp(targetPos.current, 0.15);
      setLastTime(time);
    }
  });

  return <group ref={ref} {...props}>{children}</group>;
};

const DetectedObjectMesh = ({ object }: { object: DetectedObject }) => {
  return (
    <group position={object.position}>
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.2} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.05]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>
      {/* Label billboard would be nice but simple box for now */}
    </group>
  );
};

const RobotModel = ({ isSimulating = false, isCarrying = false }: any) => {
  return (
    <group>
      {/* Legs */}
      <mesh position={[-0.15, 0.2, 0]} castShadow>
        <boxGeometry args={[0.12, 0.4, 0.12]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.15, 0.2, 0]} castShadow>
        <boxGeometry args={[0.12, 0.4, 0.12]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[0.45, 0.8, 0.25]} />
        <meshStandardMaterial color={isSimulating ? "#4466ff" : "#333"} roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.18]} />
        <meshStandardMaterial color="#555" emissive={isSimulating ? "#00ffff" : "#0077ff"} emissiveIntensity={0.5} />
        {/* Visor */}
        <mesh position={[0, 0.05, 0.12]}>
          <boxGeometry args={[0.2, 0.05, 0.02]} />
          <meshStandardMaterial color="#111" emissive={isSimulating ? "#00ffff" : "#0077ff"} />
        </mesh>
      </mesh>

      {/* 3-Segmented Arm (Right) */}
      <group position={[0.25, 1.1, 0]} rotation={[isCarrying ? -0.7 : 0.2, -0.2, 0]}>
        {/* Upper Arm */}
        <mesh position={[0.1, -0.15, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.3, 4, 8]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        
        {/* Forearm */}
        <group position={[0.1, -0.3, 0]} rotation={[isCarrying ? -1.2 : 0.5, 0.4, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          
          {/* Hand/Palm */}
          <group position={[0, -0.3, 0]} rotation={[0, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.12, 0.1, 0.1]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            {/* Fingers simplified */}
            <mesh position={[-0.03, -0.06, 0]}>
              <boxGeometry args={[0.02, 0.05, 0.02]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0.03, -0.06, 0]}>
              <boxGeometry args={[0.02, 0.05, 0.02]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          </group>
        </group>
      </group>

      {/* Left Arm (Symmetric) */}
      <group position={[-0.25, 1.1, 0]} rotation={[0.2, 0, 0]}>
        <mesh position={[-0.1, -0.15, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.3, 4, 8]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        <group position={[-0.1, -0.3, 0]} rotation={[0.5, 0, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
            <meshStandardMaterial color="#555" />
          </mesh>
        </group>
      </group>

      {/* Connection lines if simulating */}
      {isSimulating && (
        <mesh position={[0, 2.5, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 2]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
};

export default function App() {
  const { processCommand, stopProcess, isProcessing: isAgentProcessing, hasNvidia } = useAgent();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [activeStep, setActiveStep] = useState(0); 
  const [logs, setLogs] = useState<string[]>(["System initialized. Waiting for input..."]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // --- Perception State ---
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- World Model State ---
  const [robotPos, setRobotPos] = useState<[number, number, number]>([0, 0, 0]);
  const [isCarrying, setIsCarrying] = useState(false);
  const [worldObjects, setWorldObjects] = useState<DetectedObject[]>([
    { 
      id: 'red_cup_01', 
      label: 'Red cup', 
      confidence: 0.98, 
      position: [2, 0.25, 1], 
      size: [0.1, 0.15, 0.1],
      attributes: { color: 'red', material: 'plastic', type: 'container', weight: 'light' } 
    },
    { 
      id: 'table_a_01', 
      label: 'Table A', 
      confidence: 0.99, 
      position: [2, 0, 1], 
      size: [1, 0.8, 1],
      attributes: { type: 'furniture', description: 'Work Desk', surface: 'flat' } 
    },
    { 
      id: 'table_b_01', 
      label: 'Table B', 
      confidence: 0.99, 
      position: [-2, 0, -2], 
      size: [1, 0.8, 1],
      attributes: { type: 'furniture', description: 'Kitchen Counter', surface: 'flat' } 
    },
  ]);

  // Refs for real-time tracking (10Hz loop)
  const robotPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const worldObjectsRef = useRef<DetectedObject[]>([]);
  const detectedObjectsRef = useRef<DetectedObject[]>([]);

  useEffect(() => {
    robotPosRef.current = robotPos;
  }, [robotPos]);

  useEffect(() => {
    worldObjectsRef.current = worldObjects;
  }, [worldObjects]);

  useEffect(() => {
    detectedObjectsRef.current = detectedObjects;
  }, [detectedObjects]);

  // --- Dynamic Environment Loop (10Hz) ---
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-world noise/drifting of some objects (optional but creates the dynamic feel)
      // Only do this if not explicitly processing to avoid confusing the simulation
      if (cameraActive && !isAgentProcessing) {
        // Subtle drift simulation
      }
    }, 100);
    return () => clearInterval(interval);
  }, [cameraActive, isAgentProcessing]);

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

  const toggleCamera = async () => {
    if (cameraActive) {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
      addLog("Camera stream terminated.");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
        addLog("Camera stream established.");
      } catch (err) {
        addLog("Error: Camera access denied.");
      }
    }
  };

  const scanEnvironment = async () => {
    if (!cameraActive || !videoRef.current || !canvasRef.current) {
      addLog("Error: Camera not active for scan.");
      return;
    }

    setIsScanning(true);
    addLog("VISION: Capturing environment frame...");

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
        
        addLog("VISION: Invoking multimodal reasoning engine...");
        const objects = await identifyObjects(base64);
        
        setDetectedObjects(objects);
        addLog(`VISION: Detected ${objects.length} objects in sector.`);
        objects.forEach(obj => addLog(` - ${obj.label} at (${obj.position.map(n => n.toFixed(1)).join(',')})`));
      }
    } catch (err) {
      addLog(`VISION: Perception failure: ${err}`);
    } finally {
      setIsScanning(false);
    }
  };

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
      `Robot is at (${robotPosRef.current.map(n => n.toFixed(2)).join(',')}). ${isCarrying ? "Robot is currently carrying the Red cup." : "Robot is not carrying anything."} 
      System Environment Memory (PERSISTENT): ${JSON.stringify(worldObjectsRef.current)}`, 
      detectedObjectsRef.current,
      (msg, step) => {
        addLog(msg);
        setActiveStep(step);
      },
      (action, meta) => {
        // Step 4: Reactive Hardware Control (10Hz Feed)
        // CRITICAL: Ignore updates during the "mental simulation" phase
        if (meta?.isSimulation) return;

        const params = action.params as any;
        const skill = action.skill;

        if (meta?.isTick) {
          // Dynamic Interpolation based on 10Hz feedback
          if (skill === "navigate_to" && params.x !== undefined) {
             const targetX = params.x;
             const targetZ = params.z;
             
             const currentPos = robotPosRef.current;
             const dx = targetX - currentPos[0];
             const dz = targetZ - currentPos[2];
             
             // Simple lerp to show motion (usually 20 ticks)
             const stepRatio = 1 / (meta.totalTicks - meta.currentTick);
             
             // HARD CONSTRAINT: Working distance check (Safety Buffer)
             // We prevent the robot from entering a ~0.75m radius zone of the target center
             const distToTarget = Math.sqrt(dx * dx + dz * dz);
             if (distToTarget > 0.75) {
                const nextX = currentPos[0] + dx * stepRatio;
                const nextZ = currentPos[2] + dz * stepRatio;
                setRobotPos([nextX, params.y || 0, nextZ]);
             }
          }
          return;
        }

        if (meta?.isComplete) {
          addLog(`HARDWARE: Atomic action "${action.description}" finalized.`);
          
          // State transformations only happen upon successful completion of the action
          if (skill === "pick_up") {
            addLog("DYNAMICS: Manipulator locked to object.");
            setIsCarrying(true);
          }

          if (skill === "place_at" && params.x !== undefined) {
            addLog("DYNAMICS: Object released at target location.");
            setIsCarrying(false);
            setWorldObjects(prev => prev.map(obj => 
              obj.label.toLowerCase().includes('cup') 
                ? { ...obj, position: [params.x, params.y || 0.25, params.z] } 
                : obj
            ));
          }
          return;
        }
      }
    );

    if (result.success) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Task executed successfully in both virtual and physical environments." }]);
      
      // --- ROS 2 BROADCAST SIMULATION ---
      const ros2Msg = {
        header: {
          stamp: { sec: Math.floor(Date.now() / 1000), nanosec: (Date.now() % 1000) * 1000000 },
          frame_id: "map"
        },
        task_id: `eonlink_${Math.random().toString(36).substr(2, 9)}`,
        action_sequence: (result as any).actions.map((action: any) => ({
          action_type: action.skill,
          goal: action.params,
          metadata: {
            description: action.description,
            simulated: true
          }
        }))
      };

      addLog("ROS2_BRIDGE: Broadcasting ActionSequence to /agent/action_queue");
      addLog(`ROS2_PAYLOAD: ${JSON.stringify(ros2Msg)}`);
      console.log("ROS 2 Broadcast Payload:", ros2Msg);
      // ----------------------------------

    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: "Task failed during simulation. Please refine the instruction." }]);
    }
    
    setActiveStep(0);
  };

  // Sync cup position with robot if carrying - Positioned at palm/chest height
  const cupObj = worldObjects.find(obj => obj.label.toLowerCase().includes('cup'));
  const cupPosForRender = cupObj ? cupObj.position : [2, 0.25, 1] as [number, number, number];

  const effectiveCupPos: [number, number, number] = isCarrying 
    ? [robotPos[0] + 0.15, robotPos[1] + 0.9, robotPos[2] + 0.4] 
    : cupPosForRender;

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
              Engine: {hasNvidia ? "NVIDIA NIM" : "Gemini 2.0"}
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
                
                <SmoothGroup position={robotPos}>
                  <RobotModel isSimulating={activeStep === 2} isCarrying={isCarrying} />
                </SmoothGroup>

                {/* Detected Objects Mapping */}
                {detectedObjects.map(obj => (
                  <SmoothGroup key={obj.id} position={obj.position}>
                    <DetectedObjectMesh object={obj} />
                  </SmoothGroup>
                ))}
                
                {/* Simulated Objects */}
                <SmoothGroup position={effectiveCupPos}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.15, 0.12, 0.4, 32]} />
                    <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.2} />
                  </mesh>
                  <mesh position={[0, 0.2, 0.2]} castShadow rotation={[Math.PI/2, 0, 0]}>
                     <torusGeometry args={[0.08, 0.02, 16, 100, Math.PI]} />
                     <meshStandardMaterial color="#ef4444" />
                  </mesh>
                </SmoothGroup>
                
                {/* Dynamic World Objects Rendering (Tables, etc) */}
                {worldObjects.filter(obj => !obj.label.toLowerCase().includes('cup')).map(obj => (
                   <group key={obj.id} position={obj.position}>
                      <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                        <circleGeometry args={[1]} />
                        <meshStandardMaterial color="#6366f1" opacity={0.1} transparent />
                      </mesh>
                      <mesh position={[0, -0.05, 0]}>
                        <cylinderGeometry args={[obj.size?.[0] || 0.8, obj.size?.[0] || 0.8, 0.1, 32]} />
                        <meshStandardMaterial color="#cbd5e1" />
                      </mesh>
                   </group>
                ))}
              </Canvas>
            </div>
            
            {/* Viewport HUD */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <div className="px-2 py-1 rounded bg-white/80 backdrop-blur border border-slate-200 text-[10px] font-mono text-slate-500 shadow-sm">
                FPS: 30
              </div>
              <div className="px-2 py-1 rounded bg-white/80 backdrop-blur border border-slate-200 text-[10px] font-mono text-slate-500 shadow-sm">
                LATENCY: 12ms
              </div>
            </div>
            
            <div className="absolute bottom-4 left-4 flex gap-4">
               <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 backdrop-blur border border-slate-200 shadow-sm transition-all hover:bg-white cursor-pointer" onClick={toggleCamera}>
                 <Camera className={cn("w-4 h-4", cameraActive ? "text-indigo-500" : "text-slate-400")} />
                 <div className="flex flex-col">
                   <span className="text-[8px] uppercase text-slate-400 font-bold tracking-tight">Camera Feed</span>
                   <span className="text-[10px] font-bold text-slate-900 italic">{cameraActive ? "LIVE STREAM" : "OFFLINE"}</span>
                 </div>
               </div>

               {cameraActive && (
                 <button 
                  onClick={scanEnvironment}
                  disabled={isScanning}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-50"
                 >
                   {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                   <span className="text-[10px] font-bold uppercase tracking-tight">Perceptual Scan</span>
                 </button>
               )}

               <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 backdrop-blur border border-slate-200 shadow-sm">
                 <Database className="w-4 h-4 text-indigo-500" />
                 <div className="flex flex-col">
                   <span className="text-[8px] uppercase text-slate-400 font-bold tracking-tight">Skill Matrix</span>
                   <span className="text-[10px] font-bold text-slate-900 italic">{detectedObjects.length > 0 ? `${detectedObjects.length} OBJECTS REGISTERED` : "128 ACTIVE NODES"}</span>
                 </div>
               </div>
            </div>

            {/* Hidden Video/Canvas for vision processing */}
            <video ref={videoRef} autoPlay playsInline className="hidden" />
            <canvas ref={canvasRef} className="hidden" />

            {/* Picture-in-picture camera preview */}
            {cameraActive && (
              <div className="absolute top-4 left-4 w-32 aspect-video rounded-lg border-2 border-white shadow-xl overflow-hidden bg-black z-10">
                <video 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                  ref={(el) => {
                    if (el && videoRef.current?.srcObject) {
                      el.srcObject = videoRef.current.srcObject;
                    }
                  }}
                />
                <div className="absolute top-1 left-1 px-1 rounded bg-rose-500/80 text-[6px] text-white font-bold uppercase">REC</div>
              </div>
            )}
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
              {worldObjects.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[9px] font-bold uppercase text-indigo-600 mb-2 flex items-center gap-1">
                    <Database className="w-3 h-3" /> System Environment Memory
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {worldObjects.map(obj => (
                      <div key={obj.id} className="p-2 bg-indigo-50 rounded border border-indigo-100 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-indigo-700 truncate">{obj.label}</span>
                          <span className="text-[8px] font-mono text-indigo-400">({obj.position.map(n => n.toFixed(1)).join(',')})</span>
                        </div>
                        {obj.attributes && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(obj.attributes).map(([k, v]) => (
                               <span key={k} className="px-1 py-0.5 bg-white rounded text-[7px] text-indigo-400 border border-indigo-50 leading-none">
                                 {k}:{v}
                               </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
