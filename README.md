# EonLink: Embodied Intelligence System

EonLink is a next-generation multi-layer embodied intelligence system that integrates natural language reasoning, virtual world simulation, and physical hardware control. It utilizes Large Language Models (LLMs) as the "Brain" to decompose complex human goals into verifiable action sequences.

## 1. Technical Architecture

The system follows a reactive four-layer architecture:

*   **User Interaction Layer**: Parses natural language intent into high-level goals.
*   **Agent Core (The Brain)**: Uses a tiered priority chain (NVIDIA NIM -> OpenRouter -> Gemini 2.0) for task decomposition and iterative refinement, ensuring high availability and reasoning performance.
*   **World Model (Dynamic Simulator)**: A 3D environment (React Three Fiber) that performs both static pre-checks and dynamic monitoring during execution.
*   **Dynamic Hardware Bridge (ROS 2 / 10Hz Loop)**: A high-frequency control loop that translates plan segments into real-time motor commands, adjusting for environment changes at 10 FPS.

## 2. Core Operational Logic (Advanced Dynamic Loop)

### Dynamic Closed-Loop Execution
Unlike static systems that "Plan & Execute," EonLink implements a **Sense-Think-Act** loop:
1.  **Decomposition & Simulation**: The goal is decomposed and verified in a static world model.
2.  **Continuous Perception (10Hz)**: During execution, the system observes the environment at 100ms intervals.
3.  **Real-time Trajectory Adjustment**: Robot movements are no longer discrete steps but interpolated paths that can be adjusted if the target object moves or new obstacles are detected.
4.  **Reactive Re-planning**: If the state significantly deviates from the validated model during execution (e.g., "Object Lost"), the system triggers an immediate re-plan.

### Hardware Dynamics
-   **10 FPS Monitor**: The "Dynamic Control Loop" synchronizes virtual state with hardware feedback every 100ms.
-   **Proximity Standing**: Automatic calculation of 0.6m stand-off distance, maintained dynamically during navigation.
-   **Manipulator IK**: Arm poses are updated in real-time to reflect carrying state and joint constraints.

## 3. ROS 2 Integration

EonLink acts as a high-level Agentic Orchestrator for ROS 2:
-   **Nav2 Stack**: Targets are updated dynamically via `/goal_pose` or Action Servers.
-   **MoveIt Interaction**: Servo-based joint control for smooth manipulation.
-   **Vision Updates**: Real-time perception via `/tf` and object detection topics feed the 10Hz loop.

## 4. Key Refinements & Evolution

During development, the system evolved through several critical logical hardening steps:

- **Proximity Mandate**: The Brain is now strictly constrained by the "Proximity Rule." Manipulation actions (pick/place/open/close) are invalid unless preceded by a `navigate_to` the object's exact (x,z) coordinates.
- **State-Aware Planning**: The system prevents "redundant effort." If the environment state indicates the robot is already carrying the target object, the Brain automatically skips the navigation and pick-up phases, going directly to the destination.
- **Iterative Refinement Loop**: When a simulation fails (e.g., the robot attempts to pick up an object from across the room), the feedback is fed back into the Brain. This creates a "Self-Correcting Brain" that learns from its virtual failures before attempting physical motion.
- **10Hz Dynamic Interpolation**: Movement in the 3D World Model is synchronized at 10Hz. This ensures that the robot's "mental state" and "physical state" are always in sync, allowed for reactive adjustments to environmental drift.

## 5. Tech Stack

-   **Frontend**: React 18, Tailwind CSS, Three.js (React Three Fiber).
-   **Reasoning**: Google Gemini API (`@google/genai`), NVIDIA NIM (Llama-3).
-   **Data/Knowledge**: Firebase Firestore.
-   **Communication**: 10Hz internal control loop via React Refs and Hooks.

## 5. Startup & Execution

1.  **Install Dependencies**: `npm install`
2.  **Configuration**: Set `GEMINI_API_KEY` in environment.
3.  **Run Development Server**: `npm run dev`
4.  **Observation**: 
    - Enter a command.
    - Notice the "Dynamic Control Loop" logs during execution.
    - The robot moves smoothly in the 3D view at 10Hz, reacting to environment state.

---

# EonLink: 具身智能虚实融合系统 (动态版)

EonLink 是一个融合了自然语言推理、虚拟世界仿真和物理硬件控制的具身智能系统。它利用 LLM 作为“大脑”，配合 **10Hz 实时动态监控环**，实现了在变化环境下的鲁棒执行。

## 1. 技术架构 (动态升级)

系统采用响应式四层架构：

*   **用户交互层**: 解析自然语言意图。
*   **智能体核心 (大脑)**: 进行初始任务分解，并在执行过程中进行实时参数微调。
*   **世界模型 (动态仿真器)**: 在执行阶段以 10Hz 频率监控物理一致性，确保虚拟与现实同步。
*   **动态硬件桥接 (ROS 2 / 10Hz 闭环)**: 高频控制环将动作拆解为每秒 10 帧的微指令，实时响应环境变化。

## 2. 核心运行逻辑：感知-决策-行动

### 闭环动态调整
EonLink 的最大特色是从“静态规划”升级为“动态闭环”：
1.  **感知 (10 FPS)**: 系统以 100ms 为周期扫描环境，获取机器人位姿及物体最新坐标。
2.  **执行中微调**: 机器人移动时不再是瞬间移动，而是沿轨迹平滑推进。如果目标物体位置发生漂移，机器人会自动修正终点参数。
3.  **失败检测与自愈**: 如果在执行过程中检测到目标丢失或路径阻塞，系统会立即中断当前动作，触发重新规划。

## 3. ROS 2 深度集成

-   **导航自适应**: 通过 ROS 2 的 Action 机制，实时更新导航目标。
-   **感知反馈步进**: 机器人每移动一步都会与 `/odom` 和感知数据比对。
-   **安全保障**: 动态计算 0.6 米安全站位距离，在复杂环境中保持稳定。

## 4. 启动说明

1.  `npm install` 安装依赖。
2.  配置 `GEMINI_API_KEY`。
3.  执行 `npm run dev`。
4.  在执行任务时，观察日志中的 **"Dynamic Control Loop (10Hz)"**，机器人会在 3D 视图中以平滑轨迹完成动作。

