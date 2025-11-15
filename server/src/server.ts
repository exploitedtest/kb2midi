/**
 * KB2MIDI Collaborative Server
 * Handles WebSocket connections, MIDI clock distribution, and multi-client coordination
 */

import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  ClientInfo,
  Section,
  ServerState,
  ServerConfig,
  DEFAULT_SERVER_CONFIG,
  DEFAULT_SECTIONS,
  ClientMessage,
  ServerMessage,
  WelcomeMessage,
  ClientListUpdateMessage,
  NoteEventMessage,
  ClockTickMessage,
  ClockTransportMessage,
  ClientMode,
} from '../../shared/types.js';

export class KB2MIDIServer {
  private io: SocketIOServer;
  private state: ServerState;
  private config: ServerConfig;
  private clockInterval: NodeJS.Timeout | null = null;
  private currentTick = 0;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_SERVER_CONFIG, ...config };

    // Initialize server state
    this.state = {
      clients: new Map(),
      sections: new Map(),
      teacherId: null,
      clockRunning: false,
      bpm: this.config.defaultBPM,
      currentTick: 0,
    };

    // Initialize sections
    DEFAULT_SECTIONS.forEach(section => {
      this.state.sections.set(section.id, { ...section, clientIds: [] });
    });

    // Create HTTP server and Socket.IO
    const httpServer = createServer();
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // In production, restrict this to your client domain
        methods: ['GET', 'POST'],
      },
    });

    this.setupSocketHandlers();

    // Start HTTP server
    httpServer.listen(this.config.port, () => {
      console.log(`🎹 KB2MIDI Server running on port ${this.config.port}`);
      console.log(`🎵 Default BPM: ${this.config.defaultBPM}`);
      console.log(`👥 Max clients: ${this.config.maxClients}`);
      console.log(`📡 Clock: ${this.config.clockTicksPerQuarterNote} ppqn`);
    });
  }

  /**
   * Sets up Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle client messages
      socket.on('message', (msg: ClientMessage) => {
        this.handleClientMessage(socket, msg);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handles incoming client messages
   */
  private handleClientMessage(socket: Socket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join':
        this.handleJoin(socket, msg.mode, msg.name);
        break;

      case 'noteOn':
        this.handleNoteOn(socket, msg.note, msg.velocity);
        break;

      case 'noteOff':
        this.handleNoteOff(socket, msg.note);
        break;

      case 'cc':
        // CC messages can be relayed if needed
        console.log(`CC from ${socket.id}: controller=${msg.controller} value=${msg.value}`);
        break;

      case 'pitchBend':
        // Pitch bend can be relayed if needed
        console.log(`Pitch bend from ${socket.id}: ${msg.value}`);
        break;

      // Teacher-only commands
      case 'muteClient':
        this.handleMuteClient(socket, msg.clientId, msg.muted);
        break;

      case 'muteSection':
        this.handleMuteSection(socket, msg.sectionId, msg.muted);
        break;

      case 'assignSection':
        this.handleAssignSection(socket, msg.clientId, msg.sectionId);
        break;

      case 'setBPM':
        this.handleSetBPM(socket, msg.bpm);
        break;

      case 'startClock':
        this.handleStartClock(socket);
        break;

      case 'stopClock':
        this.handleStopClock(socket);
        break;

      case 'kickClient':
        this.handleKickClient(socket, msg.clientId);
        break;

      default:
        console.warn(`Unknown message type from ${socket.id}`);
    }
  }

  /**
   * Handles client join
   */
  private handleJoin(socket: Socket, mode: ClientMode, name: string): void {
    // Check if already joined
    if (this.state.clients.has(socket.id)) {
      console.warn(`Client ${socket.id} already joined`);
      return;
    }

    // Check max clients
    if (this.state.clients.size >= this.config.maxClients) {
      socket.emit('error', { message: 'Server is full' });
      socket.disconnect();
      return;
    }

    // Check if trying to join as teacher when teacher exists
    if (mode === 'teacher' && this.state.teacherId) {
      socket.emit('error', { message: 'Teacher already connected' });
      socket.disconnect();
      return;
    }

    // Assign section and color (auto-balance if enabled)
    let section = 'unassigned';
    let color = '#888888';

    if (mode === 'student' && this.config.autoAssignSections) {
      const leastPopulatedSection = this.findLeastPopulatedSection();
      if (leastPopulatedSection) {
        section = leastPopulatedSection.id;
        color = leastPopulatedSection.color;
        leastPopulatedSection.clientIds.push(socket.id);
      }
    } else if (mode === 'teacher') {
      section = 'teacher';
      color = '#ffffff';
      this.state.teacherId = socket.id;
      // Auto-start clock when teacher joins
      this.startClock();
    }

    // Create client info
    const clientInfo: ClientInfo = {
      id: socket.id,
      name,
      mode,
      color,
      section,
      activeNotes: [],
      isMuted: false,
      isConnected: true,
      lastActivity: Date.now(),
    };

    this.state.clients.set(socket.id, clientInfo);

    // Send welcome message
    const welcomeMsg: WelcomeMessage = {
      type: 'welcome',
      clientId: socket.id,
      clientInfo,
      sections: Array.from(this.state.sections.values()),
      allClients: Array.from(this.state.clients.values()),
      serverBPM: this.state.bpm,
    };
    socket.emit('message', welcomeMsg);

    // Broadcast client list update to all
    this.broadcastClientListUpdate();

    console.log(`✅ ${mode.toUpperCase()} joined: ${name} (${socket.id}) - Section: ${section}`);
  }

  /**
   * Handles note on event
   */
  private handleNoteOn(socket: Socket, note: number, velocity: number): void {
    const client = this.state.clients.get(socket.id);
    if (!client) return;

    // Update client state
    if (!client.activeNotes.includes(note)) {
      client.activeNotes.push(note);
      client.lastActivity = Date.now();
    }

    // Create note event message
    const noteMsg: NoteEventMessage = {
      type: 'noteEvent',
      clientId: socket.id,
      note,
      velocity,
      isNoteOn: true,
      timestamp: Date.now(),
    };

    // Broadcast to all clients EXCEPT sender
    socket.broadcast.emit('message', noteMsg);

    // If teacher, also output MIDI (handled by teacher client)
    if (client.mode === 'teacher') {
      // Teacher client will handle actual MIDI output
      // We just relay the note to other clients for visualization
    }
  }

  /**
   * Handles note off event
   */
  private handleNoteOff(socket: Socket, note: number): void {
    const client = this.state.clients.get(socket.id);
    if (!client) return;

    // Update client state
    const index = client.activeNotes.indexOf(note);
    if (index > -1) {
      client.activeNotes.splice(index, 1);
      client.lastActivity = Date.now();
    }

    // Create note event message
    const noteMsg: NoteEventMessage = {
      type: 'noteEvent',
      clientId: socket.id,
      note,
      velocity: 0,
      isNoteOn: false,
      timestamp: Date.now(),
    };

    // Broadcast to all clients EXCEPT sender
    socket.broadcast.emit('message', noteMsg);
  }

  /**
   * Handles client disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const client = this.state.clients.get(socket.id);
    if (!client) return;

    console.log(`🔌 Client disconnected: ${client.name} (${socket.id})`);

    // Remove from section
    const section = this.state.sections.get(client.section);
    if (section) {
      const index = section.clientIds.indexOf(socket.id);
      if (index > -1) {
        section.clientIds.splice(index, 1);
      }
    }

    // If teacher disconnected, stop clock
    if (socket.id === this.state.teacherId) {
      this.state.teacherId = null;
      this.stopClock();
      console.log('🛑 Teacher disconnected - clock stopped');
    }

    // Remove client
    this.state.clients.delete(socket.id);

    // Broadcast update
    this.broadcastClientListUpdate();
  }

  /**
   * Teacher command: Mute/unmute a client
   */
  private handleMuteClient(socket: Socket, clientId: string, muted: boolean): void {
    if (!this.isTeacher(socket)) return;

    const client = this.state.clients.get(clientId);
    if (!client) {
      console.warn(`Client ${clientId} not found`);
      return;
    }

    client.isMuted = muted;

    // Broadcast mute state
    this.io.emit('message', {
      type: 'clientMuted',
      clientId,
      isMuted: muted,
    });

    console.log(`🔇 ${client.name} ${muted ? 'muted' : 'unmuted'} by teacher`);
  }

  /**
   * Teacher command: Mute/unmute a section
   */
  private handleMuteSection(socket: Socket, sectionId: string, muted: boolean): void {
    if (!this.isTeacher(socket)) return;

    const section = this.state.sections.get(sectionId);
    if (!section) {
      console.warn(`Section ${sectionId} not found`);
      return;
    }

    section.isMuted = muted;

    // Mute all clients in section
    section.clientIds.forEach(clientId => {
      const client = this.state.clients.get(clientId);
      if (client) {
        client.isMuted = muted;
      }
    });

    // Broadcast section mute state
    this.io.emit('message', {
      type: 'sectionMuted',
      sectionId,
      isMuted: muted,
    });

    this.broadcastClientListUpdate();

    console.log(`🔇 ${section.name} ${muted ? 'muted' : 'unmuted'} by teacher`);
  }

  /**
   * Teacher command: Assign client to section
   */
  private handleAssignSection(socket: Socket, clientId: string, sectionId: string): void {
    if (!this.isTeacher(socket)) return;

    const client = this.state.clients.get(clientId);
    const section = this.state.sections.get(sectionId);

    if (!client || !section) {
      console.warn(`Client or section not found`);
      return;
    }

    // Remove from old section
    const oldSection = this.state.sections.get(client.section);
    if (oldSection) {
      const index = oldSection.clientIds.indexOf(clientId);
      if (index > -1) {
        oldSection.clientIds.splice(index, 1);
      }
    }

    // Add to new section
    client.section = sectionId;
    client.color = section.color;
    section.clientIds.push(clientId);

    // Notify client of assignment
    this.io.to(clientId).emit('message', {
      type: 'clientAssigned',
      clientId,
      section: sectionId,
      color: section.color,
    });

    this.broadcastClientListUpdate();

    console.log(`👥 ${client.name} assigned to ${section.name} by teacher`);
  }

  /**
   * Teacher command: Set BPM
   */
  private handleSetBPM(socket: Socket, bpm: number): void {
    if (!this.isTeacher(socket)) return;

    if (bpm < 40 || bpm > 300) {
      console.warn(`Invalid BPM: ${bpm}`);
      return;
    }

    this.state.bpm = bpm;

    // Restart clock with new BPM if running
    if (this.state.clockRunning) {
      this.stopClock();
      this.startClock();
    }

    // Broadcast BPM change
    this.io.emit('message', {
      type: 'bpmChanged',
      bpm,
    });

    console.log(`🎵 BPM changed to ${bpm} by teacher`);
  }

  /**
   * Teacher command: Start clock
   */
  private handleStartClock(socket: Socket): void {
    if (!this.isTeacher(socket)) return;
    this.startClock();
  }

  /**
   * Teacher command: Stop clock
   */
  private handleStopClock(socket: Socket): void {
    if (!this.isTeacher(socket)) return;
    this.stopClock();
  }

  /**
   * Teacher command: Kick client
   */
  private handleKickClient(socket: Socket, clientId: string): void {
    if (!this.isTeacher(socket)) return;

    const targetSocket = this.io.sockets.sockets.get(clientId);
    if (targetSocket) {
      targetSocket.disconnect(true);
      console.log(`🚫 Client ${clientId} kicked by teacher`);
    }
  }

  /**
   * Starts the MIDI clock
   */
  private startClock(): void {
    if (this.state.clockRunning) return;

    this.state.clockRunning = true;
    this.currentTick = 0;

    // Calculate interval in milliseconds for each tick
    // BPM = beats per minute, we need ticks per beat
    // 1 beat = 1 quarter note = 24 ticks (standard MIDI)
    const ticksPerSecond = (this.state.bpm / 60) * this.config.clockTicksPerQuarterNote;
    const intervalMs = 1000 / ticksPerSecond;

    // Send transport start
    const startMsg: ClockTransportMessage = {
      type: 'clockTransport',
      command: 'start',
      timestamp: Date.now(),
    };
    this.io.emit('message', startMsg);

    // Start clock interval
    this.clockInterval = setInterval(() => {
      this.sendClockTick();
    }, intervalMs);

    console.log(`▶️  Clock started at ${this.state.bpm} BPM (${intervalMs.toFixed(2)}ms per tick)`);
  }

  /**
   * Stops the MIDI clock
   */
  private stopClock(): void {
    if (!this.state.clockRunning) return;

    this.state.clockRunning = false;

    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }

    // Send transport stop
    const stopMsg: ClockTransportMessage = {
      type: 'clockTransport',
      command: 'stop',
      timestamp: Date.now(),
    };
    this.io.emit('message', stopMsg);

    console.log('⏹️  Clock stopped');
  }

  /**
   * Sends a clock tick to all clients
   */
  private sendClockTick(): void {
    const tickMsg: ClockTickMessage = {
      type: 'clockTick',
      tick: this.currentTick,
      bpm: this.state.bpm,
      timestamp: Date.now(),
    };

    this.io.emit('message', tickMsg);

    this.currentTick = (this.currentTick + 1) % this.config.clockTicksPerQuarterNote;
  }

  /**
   * Broadcasts client list update to all clients
   */
  private broadcastClientListUpdate(): void {
    const updateMsg: ClientListUpdateMessage = {
      type: 'clientListUpdate',
      clients: Array.from(this.state.clients.values()),
      sections: Array.from(this.state.sections.values()),
    };

    this.io.emit('message', updateMsg);
  }

  /**
   * Finds the section with the fewest clients
   */
  private findLeastPopulatedSection(): Section | null {
    let minCount = Infinity;
    let targetSection: Section | null = null;

    this.state.sections.forEach(section => {
      if (section.id !== 'teacher' && section.clientIds.length < minCount) {
        minCount = section.clientIds.length;
        targetSection = section;
      }
    });

    return targetSection;
  }

  /**
   * Checks if socket is the teacher
   */
  private isTeacher(socket: Socket): boolean {
    const isTeacher = socket.id === this.state.teacherId;
    if (!isTeacher) {
      console.warn(`Non-teacher ${socket.id} attempted teacher command`);
    }
    return isTeacher;
  }

  /**
   * Gets current server statistics
   */
  public getStats() {
    return {
      connectedClients: this.state.clients.size,
      teacherConnected: !!this.state.teacherId,
      clockRunning: this.state.clockRunning,
      bpm: this.state.bpm,
      sections: Array.from(this.state.sections.values()).map(s => ({
        id: s.id,
        name: s.name,
        clients: s.clientIds.length,
        muted: s.isMuted,
      })),
    };
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new KB2MIDIServer({
    port: parseInt(process.env.PORT || '3000'),
  });

  // Log stats every 30 seconds
  setInterval(() => {
    const stats = server.getStats();
    console.log('\n📊 Server Stats:');
    console.log(`   Clients: ${stats.connectedClients}`);
    console.log(`   Teacher: ${stats.teacherConnected ? '✅' : '❌'}`);
    console.log(`   Clock: ${stats.clockRunning ? `▶️  ${stats.bpm} BPM` : '⏹️  Stopped'}`);
    console.log(`   Sections:`);
    stats.sections.forEach(s => {
      console.log(`     - ${s.name}: ${s.clients} clients ${s.muted ? '🔇' : ''}`);
    });
  }, 30000);
}
