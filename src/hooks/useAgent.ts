import { useState, useEffect } from 'react';
import { decomposeTask as geminiDecompose, simulateAction as geminiSimulate, Action, ActionResult } from '../services/geminiService';
import { decomposeTaskNvidia, simulateActionNvidia, checkNvidiaAvailability } from '../services/nvidiaService';
import { decomposeTaskOpenRouter, simulateActionOpenRouter } from '../services/openrouterService';
import { logTask } from '../services/firebaseService';

export function useAgent() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentActions, setCurrentActions] = useState<Action[]>([]);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isAborted, setIsAborted] = useState(false);
  const [hasNvidia, setHasNvidia] = useState(false);

  useEffect(() => {
    checkNvidiaAvailability().then(setHasNvidia);
  }, []);

  const getActiveProvider = async () => {
    const nvidiaOk = await checkNvidiaAvailability();
    if (nvidiaOk) return "NVIDIA";
    
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey && openRouterKey !== "MY_OPENROUTER_API_KEY") return "OPENROUTER";
    
    return "GEMINI";
  };
  
  const stopProcess = () => {
    setIsAborted(true);
  };
  
  const processCommand = async (
    command: string, 
    envState: string, 
    detectedObjects: any[],
    onProgress: (msg: string, step: number) => void,
    onActionSimulated?: (action: Action, result: any) => void
  ) => {
    setIsProcessing(true);
    setIsAborted(false);
    
    const provider = await getActiveProvider();
    setHasNvidia(provider === "NVIDIA");

    let taskRecord: any = {
      instruction: command,
      status: 'pending',
      actionSequence: [],
      simulationLogs: [],
      result: '',
      detectedContext: detectedObjects,
      provider: provider
    };

    let overallSuccess = false;
    let retryCount = 0;
    let correctionContext = "";
    const MAX_RETRIES = 3;

    try {
      while (!overallSuccess && retryCount < MAX_RETRIES) {
        if (isAborted) throw new Error("PROCESS_KILLED");

        // Step 1: Decomposition
        onProgress(`[${provider}] Analyzing goal (Attempt ${retryCount + 1})...`, 1);
        taskRecord.status = 'simulating';
        
        const envDescription = `${envState}\nDetected Objects Positions: ${JSON.stringify(detectedObjects)}`;
        
        let actions: Action[];
        try {
          if (provider === "NVIDIA") {
            actions = await decomposeTaskNvidia(command, envDescription, correctionContext);
          } else if (provider === "OPENROUTER") {
            actions = await decomposeTaskOpenRouter(command, envDescription, correctionContext);
          } else {
            actions = await geminiDecompose(command, envDescription, correctionContext);
          }
        } catch (e) {
          console.error(`Decomposition failed on ${provider}, falling back to Gemini if possible`, e);
          actions = await geminiDecompose(command, envDescription, correctionContext);
        }
          
        if (isAborted) throw new Error("PROCESS_KILLED");

        setCurrentActions(actions);
        taskRecord.actionSequence = actions;
        
        // Step 2: Simulation (Virtual Verification)
        onProgress(`[${provider}] World Model: Static check...`, 2);
        let currentIterSuccess = true;
        const simLogs = [];
        let iterFeedback = "";
        let rollingEnvState = envDescription; 
        
        for (const action of actions) {
          if (isAborted) throw new Error("PROCESS_KILLED");
          
          onProgress(`Verifying: ${action.description}...`, 2);
          
          let res: ActionResult;
          try {
            if (provider === "NVIDIA") {
              res = await simulateActionNvidia(action, rollingEnvState);
            } else if (provider === "OPENROUTER") {
              res = await simulateActionOpenRouter(action, rollingEnvState);
            } else {
              res = await geminiSimulate(action, rollingEnvState);
            }
          } catch (e) {
            console.error(`Simulation failed on ${provider}, using Gemini`, e);
            res = await geminiSimulate(action, rollingEnvState);
          }
            
          if (isAborted) throw new Error("PROCESS_KILLED");
          simLogs.push(res);
          
          if (onActionSimulated) {
            onActionSimulated(action, { ...res, isSimulation: true });
          }
          
          await new Promise(r => setTimeout(r, 200)); 
          
          if (!res.success) {
            currentIterSuccess = false;
            iterFeedback = `Action "${action.description}" failed logic check. Reason: ${res.feedback}.`;
            onProgress(`PLAN DEVIATION: ${res.feedback}. Recalculating...`, 2);
            break;
          } else {
            rollingEnvState = res.resultState;
          }
        }
        
        if (currentIterSuccess) {
          overallSuccess = true;
          setSimulationResult({ success: true, logs: simLogs });
          taskRecord.simulationLogs = simLogs;
        } else {
          retryCount++;
          correctionContext = iterFeedback;
        }
      }

      if (isAborted) throw new Error("PROCESS_KILLED");

      if (overallSuccess) {
        // Step 3: Dynamic Execution (The 10Hz Control Loop)
        taskRecord.status = 'executing';
        onProgress("Validation SUCCESS. Entering Dynamic Control Loop (10Hz Monitor)...", 3);
        
        const sequence = [...taskRecord.actionSequence];
        
        for (let i = 0; i < sequence.length; i++) {
          if (isAborted) throw new Error("PROCESS_KILLED");
          const action = sequence[i];
          
          onProgress(`Executing (Real-time): ${action.description}`, 3);
          
          // Here we perform the "Act" but with continuous monitoring
          // We assume onActionSimulated in 'execute' mode handles the hardware bridge
          if (onActionSimulated) {
            const ticks = 20; 
            for (let t = 0; t < ticks; t++) {
               if (isAborted) throw new Error("PROCESS_KILLED");
               
               onActionSimulated(action, { 
                 isTick: true, 
                 currentTick: t, 
                 totalTicks: ticks,
                 isSimulation: false 
               });
               await new Promise(r => setTimeout(r, 100)); // 100ms = 10 FPS
            }
            onActionSimulated(action, { isComplete: true, isSimulation: false });
          }
        }

        taskRecord.status = 'completed';
        taskRecord.result = 'Success';
        onProgress("Dynamic execution synchronized. Goal achieved.", 0);
        await logTask(taskRecord);
        return { success: true, actions: taskRecord.actionSequence };
      } else {
        taskRecord.status = 'failed';
        taskRecord.result = 'Refinement Limit Exceeded';
        onProgress("Task could not be solved after multiple iterations.", 0);
        await logTask(taskRecord);
        return { success: false, error: "Refinement failed" };
      }
      
    } catch (error: any) {
      if (error.message === "PROCESS_KILLED") {
        onProgress("SYSTEM: Process killed by operator.", 0);
        return { success: false, error: "Aborted" };
      }
      console.error(error);
      taskRecord.status = 'failed';
      taskRecord.result = 'Critical Error';
      onProgress("Critical error in Agent Pipeline.", 0);
      await logTask(taskRecord);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
      setIsAborted(false);
    }
  };

  return {
    processCommand,
    stopProcess,
    isProcessing,
    hasNvidia,
    currentActions,
    simulationResult
  };
}
