/**
 * Network client for collaborative MIDI mode
 * Handles WebSocket connection to kb2midi server
 */

import { io, Socket } from 'socket.io-client';
import type {
  ClientMode,
  ClientInfo,
  Section,
  ServerMessage,
  ClientMessage,
  WelcomeMessage,
  NoteEventMessage,
  ClockTickMessage,
} from '../shared/types';

export interface NetworkClientCallbacks {
  onWelcome?: (msg: WelcomeMessage) => void;
  onClientListUpdate?: (clients: ClientInfo[], sections: Section[]) => void;
  onNoteEvent?: (msg: NoteEventMessage) => void;
  onClockTick?: (msg: ClockTickMessage) => void;
  onClockTransport?: (command: 'start' | 'stop' | 'continue') => void;
  onClientMuted?: (clientId: string, isMuted: boolean) => void;
  onSectionMuted?: (sectionId: string, isMuted: boolean) => void;
  onClientAssigned?: (clientId: string, section: string, color: string) => void;
  onBPMChanged?: (bpm: number) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export class NetworkClient {
  private socket: Socket | null = null;
  private callbacks: NetworkClientCallbacks = {};
  private _isConnected = false;
  private _clientId: string | null = null;
  private _clientInfo: ClientInfo | null = null;

  /**
   * Connects to the server
   */
  connect(serverUrl: string, mode: ClientMode, name: string): void {
    if (this.socket) {
      console.warn('Already connected');
      return;
    }

    console.log(`Connecting to ${serverUrl} as ${mode}...`);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    // Connection established
    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      this._isConnected = true;

      // Send join message
      const joinMsg: ClientMessage = {
        type: 'join',
        mode,
        name,
      };
      this.send(joinMsg);

      if (this.callbacks.onConnected) {
        this.callbacks.onConnected();
      }
    });

    // Disconnection
    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      this._isConnected = false;
      this._clientId = null;
      this._clientInfo = null;

      if (this.callbacks.onDisconnected) {
        this.callbacks.onDisconnected();
      }
    });

    // Error handling
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error(`Connection error: ${error.message}`));
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error(`Socket error: ${error.message || error}`));
      }
    });

    // Message handling
    this.socket.on('message', (msg: ServerMessage) => {
      this.handleServerMessage(msg);
    });
  }

  /**
   * Disconnects from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._isConnected = false;
      this._clientId = null;
      this._clientInfo = null;
    }
  }

  /**
   * Sends a message to the server
   */
  send(msg: ClientMessage): void {
    if (!this.socket || !this._isConnected) {
      console.warn('Cannot send message - not connected');
      return;
    }

    this.socket.emit('message', msg);
  }

  /**
   * Handles messages from server
   */
  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        this._clientId = msg.clientId;
        this._clientInfo = msg.clientInfo;
        console.log(`✅ Joined as ${msg.clientInfo.name} (${msg.clientInfo.mode})`);
        console.log(`   Section: ${msg.clientInfo.section}`);
        console.log(`   Color: ${msg.clientInfo.color}`);
        if (this.callbacks.onWelcome) {
          this.callbacks.onWelcome(msg);
        }
        break;

      case 'clientListUpdate':
        if (this.callbacks.onClientListUpdate) {
          this.callbacks.onClientListUpdate(msg.clients, msg.sections);
        }
        break;

      case 'noteEvent':
        if (this.callbacks.onNoteEvent) {
          this.callbacks.onNoteEvent(msg);
        }
        break;

      case 'clockTick':
        if (this.callbacks.onClockTick) {
          this.callbacks.onClockTick(msg);
        }
        break;

      case 'clockTransport':
        if (this.callbacks.onClockTransport) {
          this.callbacks.onClockTransport(msg.command);
        }
        break;

      case 'clientMuted':
        if (this.callbacks.onClientMuted) {
          this.callbacks.onClientMuted(msg.clientId, msg.isMuted);
        }
        break;

      case 'sectionMuted':
        if (this.callbacks.onSectionMuted) {
          this.callbacks.onSectionMuted(msg.sectionId, msg.isMuted);
        }
        break;

      case 'clientAssigned':
        if (this.callbacks.onClientAssigned) {
          this.callbacks.onClientAssigned(msg.clientId, msg.section, msg.color);
        }
        // Update own client info if this is us
        if (msg.clientId === this._clientId && this._clientInfo) {
          this._clientInfo.section = msg.section;
          this._clientInfo.color = msg.color;
        }
        break;

      case 'bpmChanged':
        if (this.callbacks.onBPMChanged) {
          this.callbacks.onBPMChanged(msg.bpm);
        }
        break;

      default:
        console.warn('Unknown message type:', (msg as any).type);
    }
  }

  /**
   * Sets callbacks for server events
   */
  setCallbacks(callbacks: NetworkClientCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Sends note on event
   */
  sendNoteOn(note: number, velocity: number): void {
    this.send({
      type: 'noteOn',
      note,
      velocity,
    });
  }

  /**
   * Sends note off event
   */
  sendNoteOff(note: number): void {
    this.send({
      type: 'noteOff',
      note,
    });
  }

  /**
   * Sends CC message
   */
  sendCC(controller: number, value: number): void {
    this.send({
      type: 'cc',
      controller,
      value,
    });
  }

  /**
   * Sends pitch bend message
   */
  sendPitchBend(value: number): void {
    this.send({
      type: 'pitchBend',
      value,
    });
  }

  // Teacher-only commands

  /**
   * Mutes/unmutes a client (teacher only)
   */
  muteClient(clientId: string, muted: boolean): void {
    this.send({
      type: 'muteClient',
      clientId,
      muted,
    });
  }

  /**
   * Mutes/unmutes a section (teacher only)
   */
  muteSection(sectionId: string, muted: boolean): void {
    this.send({
      type: 'muteSection',
      sectionId,
      muted,
    });
  }

  /**
   * Assigns client to section (teacher only)
   */
  assignSection(clientId: string, sectionId: string): void {
    this.send({
      type: 'assignSection',
      clientId,
      sectionId,
    });
  }

  /**
   * Sets BPM (teacher only)
   */
  setBPM(bpm: number): void {
    this.send({
      type: 'setBPM',
      bpm,
    });
  }

  /**
   * Starts clock (teacher only)
   */
  startClock(): void {
    this.send({
      type: 'startClock',
    });
  }

  /**
   * Stops clock (teacher only)
   */
  stopClock(): void {
    this.send({
      type: 'stopClock',
    });
  }

  /**
   * Kicks a client (teacher only)
   */
  kickClient(clientId: string): void {
    this.send({
      type: 'kickClient',
      clientId,
    });
  }

  // Getters

  get isConnected(): boolean {
    return this._isConnected;
  }

  get clientId(): string | null {
    return this._clientId;
  }

  get clientInfo(): ClientInfo | null {
    return this._clientInfo;
  }
}
