# EonLink: Embodied Intelligence System

EonLink is a next-generation multi-layer embodied intelligence system that integrates natural language reasoning, virtual world simulation, and physical hardware control. It utilizes Large Language Models (LLMs) as the "Brain" to decompose complex human goals into verifiable action sequences.

## 1. Technical Architecture

The system follows a four-layer architecture designed for high-fidelity reasoning and safe physical execution:

*   **User Interaction Layer**: Parses natural language intent (e.g., "Bring me the red cup") into high-level goals.
*   **Agent Core (The Brain)**: Uses Gemini (Google) or Llama-3 (NVIDIA NIM) to perform cross-modal task decomposition.
*   **World Model (Simulation)**: A 3D environment (built with React Three Fiber) that serves as a "mental space" where actions are validated against physical constraints (proximity, carrying state, etc.) before the real robot moves.
*   **Hardware Bridge (ROS 2)**: Translates validated virtual actions into specific ROS 2 messages/commands for physical robot control.

## 2. Core Operational Logic

### Task Decomposition & Self-Correction Loop
1.  **Decomposition**: The Brain receives the goal and the current environmental state (robot position, detected objects, carrying state).
2.  **SOP Alignment**: It follows a Standard Operating Procedure (e.g., Navigate-to -> Pick-up -> Navigate-to -> Place).
3.  **Virtual Validation**: Each action is sent to the World Model.
    *   *Success*: The internal state updates (e.g., robot now "isCarrying: true").
    *   *Deviation*: If a logic error occurs (e.g., "Too far to pick up"), the simulator provides feedback.
4.  **Refinement**: The Brain receives the failure feedback and re-generates a corrected sequence (e.g., adding a missing `navigate_to` step).
5.  **Execution**: Once the entire sequence passes simulation, it is broadcast to the hardware interface.

### Motion Dynamics
-   **Proximity Standing**: The robot automatically calculates a 0.6m stand-off distance from targets to avoid collisions while maintaining reachability.
-   **Manipulator IK**: Arms adjust dynamically based on the `isCarrying` state to reflect a realistic "chest-level" hold for grabbed objects.

## 3. ROS 2 Integration

EonLink acts as a high-level Orchestrator for ROS 2:
-   **Navigation**: Targets are sent to the `nav2` stack via coordinate-based goals.
-   **Manipulation**: `pick_up` and `place_at` commands map to MoveIt or specific gripper drivers.
-   **Perception**: Real-time object detections from ROS topics (e.g., `/detected_objects`) update the Environment State in the system.

## 4. Tech Stack

-   **Frontend**: React 18, Tailwind CSS, Three.js (React Three Fiber).
-   **Reasoning**: Google Gemini API (`@google/genai`), NVIDIA NIM (Llama-3).
-   **Data/Knowledge**: Firebase Firestore (Skill Library & Task Logs).
-   **Animation**: Motion (Framer Motion).

## 5. Startup & Execution

1.  **Install Dependencies**: `npm install`
2.  **Configuration**: Set `GEMINI_API_KEY` and NVIDIA API keys in the environment.
3.  **Run Development Server**: `npm run dev`
4.  **Operation**: 
    - Enter a high-level command in the prompt.
    - Monitor the "World Model" (3D view) for the simulation loop.
    - Observe the hardware logs for the final ROS 2 broadcast.

---

# EonLink: 具身智能虚实融合系统

EonLink 是一个融合了自然语言推理、虚拟世界仿真和物理硬件控制的下一代多层具身智能系统。它利用大语言模型（LLM）作为“大脑”，将复杂的人类目标分解为可验证的动作序列。

## 1. 技术架构

系统遵循四层架构设计，旨在实现高保真推理和安全的物理执行：

*   **用户交互层 (User Interaction Layer)**: 将自然语言意图（如“去把红色的杯子拿过来”）解析为高级目标。
*   **智能体核心 (Agent Core/大脑)**: 使用 Gemini (Google) 或 Llama-3 (NVIDIA NIM) 进行跨模态任务分解。
*   **世界模型 (World Model/仿真)**: 基于 React Three Fiber 构建的 3D 环境，作为“心理空间”在物理机器人动作前验证物理约束（如距离、抓取状态等）。
*   **硬件桥接层 (Hardware Bridge/ROS 2)**: 将验证通过的虚拟动作转化为具体的 ROS 2 消息/命令，用于物理机器人控制。

## 2. 核心运行逻辑

### 任务分解与自进化闭环
1.  **分解**: “大脑”接收目标和当前环境状态（机器人位置、检测到的物体、抓取状态）。
2.  **SOP 对齐**: 遵循标准操作程序（如：导航 -> 拿起 -> 导航 -> 放置）。
3.  **虚拟验证**: 每个动作被发送到“世界模型”。
    *   *成功*: 内部状态更新（如：机器人进入“正在携带：是”状态）。
    *   *偏差*: 如果发生逻辑错误（如“距离太远无法拿起”），模拟器会提供反馈。
4.  **迭代修正**: “大脑”接收失败反馈，重新生成修正后的序列（例如，补上缺失的导航步骤）。
5.  **最终执行**: 只有当整个序列通过仿真验证后，才会被广播到硬件接口。

### 运动动力学
-   **近身站位**: 机器人自动计算距目标 0.6 米的站立距离，在避免碰撞的同时确保可触达性。
-   **机械臂逆运动学 (IK)**: 手臂根据“携带状态”动态调整，实现将物体放在胸前的真实抓取姿态。

## 3. ROS 2 对接

EonLink 作为 ROS 2 的高级任务编排器：
-   **导航**: 坐标目标被发送至 `nav2` 导航堆栈。
-   **操作**: `pick_up` 和 `place_at` 命令映射到 MoveIt 或特定的夹爪驱动器。
-   **感知**: 来自 ROS 话题（如 `/detected_objects`）的实时物体检测数据会更新系统中的环境状态。

## 4. 技术栈

-   **前端**: React 18, Tailwind CSS, Three.js (React Three Fiber).
-   **推理**: Google Gemini API, NVIDIA NIM (Llama-3).
-   **数据/知识**: Firebase Firestore (技能库与任务日志)。
-   **动画**: Motion (Framer Motion).

## 5. 启动与执行

1.  **安装依赖**: `npm install`
2.  **环境配置**: 在环境中设置 `GEMINI_API_KEY` 和 NVIDIA API 密钥。
3.  **启动开发服务器**: `npm run dev`
4.  **操作步骤**:
    - 在提示框中输入高级指令。
    - 观察“世界模型”（3D 视图）中的仿真闭环。
    - 查看硬件日志中的最终 ROS 2 广播消息。
