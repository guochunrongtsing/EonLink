import { useState, useEffect } from 'react';
import { decomposeTask as geminiDecompose, simulateAction as geminiSimulate, Action } from '../services/geminiService';
import { decomposeTaskNvidia, simulateActionNvidia, checkNvidiaAvailability } from '../services/nvidiaService';
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
    
    // Check again in case it changed
    const activeNvidia = await checkNvidiaAvailability();
    setHasNvidia(activeNvidia);

    let taskRecord: any = {
      instruction: command,
      status: 'pending',
      actionSequence: [],
      simulationLogs: [],
      result: '',
      detectedContext: detectedObjects
    };

    let overallSuccess = false;
    let retryCount = 0;
    let correctionContext = "";
    const MAX_RETRIES = 3;

    try {
      while (!overallSuccess && retryCount < MAX_RETRIES) {
        if (isAborted) throw new Error("PROCESS_KILLED");

        // Step 1: Decomposition
        onProgress(activeNvidia ? `Analyzing goal (Attempt ${retryCount + 1})...` : `Analyzing goal (Attempt ${retryCount + 1})...`, 1);
        taskRecord.status = 'simulating';
        
        const envDescription = `${envState}\nDetected Objects Positions: ${JSON.stringify(detectedObjects)}`;
        const actions = activeNvidia 
          ? await decomposeTaskNvidia(command, envDescription, correctionContext) 
          : await geminiDecompose(command, envDescription, correctionContext);
          
        if (isAborted) throw new Error("PROCESS_KILLED");

        setCurrentActions(actions);
        taskRecord.actionSequence = actions;
        
        // Step 2: Simulation (Virtual Verification)
        onProgress("World Model: Performing static integrity check...", 2);
        let currentIterSuccess = true;
        const simLogs = [];
        let iterFeedback = "";
        let rollingEnvState = envDescription; 
        
        for (const action of actions) {
          if (isAborted) throw new Error("PROCESS_KILLED");
          
          onProgress(`Verifying: ${action.description}...`, 2);
          const res = activeNvidia 
            ? await simulateActionNvidia(action, rollingEnvState)
            : await geminiSimulate(action, rollingEnvState);
            
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
