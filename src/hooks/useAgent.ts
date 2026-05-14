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
        
        // Step 2: Simulation
        onProgress("Validating action sequence in World Model...", 2);
        let currentIterSuccess = true;
        const simLogs = [];
        let iterFeedback = "";
        let rollingEnvState = envDescription; // Use the same description format
        
        for (const action of actions) {
          if (isAborted) throw new Error("PROCESS_KILLED");
          
          onProgress(`Simulating: ${action.description}...`, 2);
          const res = activeNvidia 
            ? await simulateActionNvidia(action, rollingEnvState)
            : await geminiSimulate(action, rollingEnvState);
            
          if (isAborted) throw new Error("PROCESS_KILLED");

          simLogs.push(res);
          
          if (onActionSimulated) {
            onActionSimulated(action, res);
          }
          
          await new Promise(r => setTimeout(r, 800)); // Visual delay for simulation steps
          
          if (!res.success) {
            currentIterSuccess = false;
            iterFeedback = `Action "${action.description}" failed logic check. Reason: ${res.feedback}. Previous state was ${res.resultState}.`;
            onProgress(`DEVIATION DETECTED: ${res.feedback}. Self-correcting...`, 2);
            break;
          } else {
            // Update the rolling state for the next action's simulation
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
          if (retryCount >= MAX_RETRIES) {
             setSimulationResult({ success: false, logs: simLogs });
             taskRecord.simulationLogs = simLogs;
          }
        }
      }

      if (isAborted) throw new Error("PROCESS_KILLED");

      if (overallSuccess) {
        // Step 3: Execution
        taskRecord.status = 'executing';
        onProgress("World Model validation SUCCESS. Broadcasting to hardware...", 3);
        await new Promise(r => setTimeout(r, 1500)); 
        
        if (isAborted) throw new Error("PROCESS_KILLED");

        taskRecord.status = 'completed';
        taskRecord.result = 'Success';
        onProgress("Execution complete.", 0);
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
