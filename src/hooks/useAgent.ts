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
      result: ''
    };

    try {
      // Step 1: Decomposition
      onProgress(activeNvidia ? "Analyzing command with NVIDIA NIM..." : "Analyzing command with Gemini...", 1);
      taskRecord.status = 'simulating';
      
      const actions = activeNvidia 
        ? await decomposeTaskNvidia(command, envState) 
        : await geminiDecompose(command, envState);
        
      if (isAborted) throw new Error("PROCESS_KILLED");

      setCurrentActions(actions);
      taskRecord.actionSequence = actions;
      
      // Step 2: Simulation
      onProgress(activeNvidia ? "Running NVIDIA World Model simulation..." : "Running Gemini World Model simulation...", 2);
      let overallSuccess = true;
      const simLogs = [];
      
      for (const action of actions) {
        if (isAborted) throw new Error("PROCESS_KILLED");
        
        onProgress(`Simulating: ${action.description}...`, 2);
        const res = activeNvidia 
          ? await simulateActionNvidia(action, envState)
          : await geminiSimulate(action, envState);
          
        if (isAborted) throw new Error("PROCESS_KILLED");

        simLogs.push(res);
        
        if (onActionSimulated) {
          onActionSimulated(action, res);
        }
        
        await new Promise(r => setTimeout(r, 1000)); // Visual delay for simulation steps
        
        if (!res.success) {
          overallSuccess = false;
          onProgress(`Simulation FAILED for: ${action.description}. Retrying with adjustment...`, 2);
          break;
        }
      }
      
      if (isAborted) throw new Error("PROCESS_KILLED");

      setSimulationResult({ success: overallSuccess, logs: simLogs });
      taskRecord.simulationLogs = simLogs;
      
      if (overallSuccess) {
        // Step 3: Execution
        taskRecord.status = 'executing';
        onProgress("Virtual validation successful. Transferring to Robot Interface...", 3);
        await new Promise(r => setTimeout(r, 2000)); // Simulate hardware latency
        
        if (isAborted) throw new Error("PROCESS_KILLED");

        taskRecord.status = 'completed';
        taskRecord.result = 'Success';
        onProgress("Execution complete.", 0);
        await logTask(taskRecord);
        return { success: true, actions };
      } else {
        taskRecord.status = 'failed';
        taskRecord.result = 'Simulation Failure';
        onProgress("Task simulation failed. Manual intervention may be required.", 0);
        await logTask(taskRecord);
        return { success: false, error: "Simulation failed" };
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
