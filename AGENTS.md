# EonLink: Embodied Intelligence System Guidelines

This project implements a multi-layer embodied intelligence system as per the "具身智能虚实融合自进化系统" technical proposal.

## Architecture
1. **User Interaction Layer**: Natural language intent parsing.
2. **Agent Layer**: Task decomposition and action sequencing using Gemini.
3. **World Model**: 3D simulation for action verification.
4. **Physical Bridge**: Mapping virtual actions to robot controls.

## Design Principles
- **Virtual First**: All actions must be validated in the World Model before physical execution.
- **Skill Evolution**: New skills discovered during tasks are persisted in the Skill Library.
- **High Fidelity**: Use 3D visualization to represent the "World Model".

## Tech Stack
- Frontend: React + Tailwind + Three.js (React Three Fiber)
- Reasoning: Gemini API (@google/genai)
- Data: Firebase (Firestore for Skill Library)
