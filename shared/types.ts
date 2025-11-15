/**
 * Shared types for kb2midi collaborative mode
 * Used by both client and server for WebSocket communication
 */

// ============================================================================
// Client Modes
// ============================================================================

export type ClientMode = 'solo' | 'teacher' | 'student';

// ============================================================================
// Client Information
// ============================================================================

export interface ClientInfo {
  id: string;
  name: string;
  mode: ClientMode;
  color: string;
  section: string;
  activeNotes: number[];
  isMuted: boolean;
  isConnected: boolean;
  lastActivity: number;
}

// ============================================================================
// Section Configuration
// ============================================================================

export interface Section {
  id: string;
  name: string;
  color: string;
  isMuted: boolean;
  clientIds: string[];
}

// Pre-defined sections for classroom use
export const DEFAULT_SECTIONS: Omit<Section, 'clientIds'>[] = [
  { id: 'red', name: 'Red Section', color: '#ff4444', isMuted: false },
  { id: 'blue', name: 'Blue Section', color: '#4444ff', isMuted: false },
  { id: 'green', name: 'Green Section', color: '#44ff44', isMuted: false },
  { id: 'yellow', name: 'Yellow Section', color: '#ffff44', isMuted: false },
  { id: 'purple', name: 'Purple Section', color: '#ff44ff', isMuted: false },
  { id: 'orange', name: 'Orange Section', color: '#ff8844', isMuted: false },
];

// ============================================================================
// Server to Client Messages
// ============================================================================

export interface WelcomeMessage {
  type: 'welcome';
  clientId: string;
  clientInfo: ClientInfo;
  sections: Section[];
  allClients: ClientInfo[];
  serverBPM: number;
}

export interface ClientListUpdateMessage {
  type: 'clientListUpdate';
  clients: ClientInfo[];
  sections: Section[];
}

export interface NoteEventMessage {
  type: 'noteEvent';
  clientId: string;
  note: number;
  velocity: number;
  isNoteOn: boolean;
  timestamp: number;
}

export interface ClockTickMessage {
  type: 'clockTick';
  tick: number; // 0-23 (24 ppqn)
  bpm: number;
  timestamp: number;
}

export interface ClockTransportMessage {
  type: 'clockTransport';
  command: 'start' | 'stop' | 'continue';
  timestamp: number;
}

export interface ClientMutedMessage {
  type: 'clientMuted';
  clientId: string;
  isMuted: boolean;
}

export interface SectionMutedMessage {
  type: 'sectionMuted';
  sectionId: string;
  isMuted: boolean;
}

export interface ClientAssignedMessage {
  type: 'clientAssigned';
  clientId: string;
  section: string;
  color: string;
}

export interface BPMChangedMessage {
  type: 'bpmChanged';
  bpm: number;
}

export type ServerMessage =
  | WelcomeMessage
  | ClientListUpdateMessage
  | NoteEventMessage
  | ClockTickMessage
  | ClockTransportMessage
  | ClientMutedMessage
  | SectionMutedMessage
  | ClientAssignedMessage
  | BPMChangedMessage;

// ============================================================================
// Client to Server Messages
// ============================================================================

export interface JoinMessage {
  type: 'join';
  mode: ClientMode;
  name: string;
}

export interface NoteOnMessage {
  type: 'noteOn';
  note: number;
  velocity: number;
}

export interface NoteOffMessage {
  type: 'noteOff';
  note: number;
}

export interface CCMessage {
  type: 'cc';
  controller: number;
  value: number;
}

export interface PitchBendMessage {
  type: 'pitchBend';
  value: number; // -8192 to 8191
}

// Teacher-only commands
export interface MuteClientCommand {
  type: 'muteClient';
  clientId: string;
  muted: boolean;
}

export interface MuteSectionCommand {
  type: 'muteSection';
  sectionId: string;
  muted: boolean;
}

export interface AssignSectionCommand {
  type: 'assignSection';
  clientId: string;
  sectionId: string;
}

export interface SetBPMCommand {
  type: 'setBPM';
  bpm: number;
}

export interface StartClockCommand {
  type: 'startClock';
}

export interface StopClockCommand {
  type: 'stopClock';
}

export interface KickClientCommand {
  type: 'kickClient';
  clientId: string;
}

export type ClientMessage =
  | JoinMessage
  | NoteOnMessage
  | NoteOffMessage
  | CCMessage
  | PitchBendMessage
  | MuteClientCommand
  | MuteSectionCommand
  | AssignSectionCommand
  | SetBPMCommand
  | StartClockCommand
  | StopClockCommand
  | KickClientCommand;

// ============================================================================
// Server State
// ============================================================================

export interface ServerState {
  clients: Map<string, ClientInfo>;
  sections: Map<string, Section>;
  teacherId: string | null;
  clockRunning: boolean;
  bpm: number;
  currentTick: number;
}

// ============================================================================
// Configuration
// ============================================================================

export interface ServerConfig {
  port: number;
  defaultBPM: number;
  maxClients: number;
  clockTicksPerQuarterNote: number; // Standard MIDI is 24ppqn
  autoAssignSections: boolean; // Auto-assign students to balance sections
}

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 3000,
  defaultBPM: 120,
  maxClients: 100,
  clockTicksPerQuarterNote: 24,
  autoAssignSections: true,
};
