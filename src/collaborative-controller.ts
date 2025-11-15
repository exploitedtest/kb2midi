/**
 * Collaborative Controller
 * Manages collaborative mode (teacher/student) functionality
 */

import { NetworkClient } from './network-client';
import type { IMidiEngine } from './types';
import type {
  ClientMode,
  ClientInfo,
  Section,
  WelcomeMessage,
  NoteEventMessage,
} from '../shared/types';

export class CollaborativeController {
  private networkClient: NetworkClient;
  private mode: ClientMode = 'solo';
  private midiEngine: IMidiEngine | null = null;
  private currentChannel = 1;
  private isMuted = false;

  // Client state
  private connectedClients: ClientInfo[] = [];
  private sections: Section[] = [];

  // UI Elements
  private modeSelect: HTMLSelectElement | null = null;
  private networkControls: HTMLElement | null = null;
  private serverUrlInput: HTMLInputElement | null = null;
  private userNameInput: HTMLInputElement | null = null;
  private connectButton: HTMLButtonElement | null = null;
  private networkStatus: HTMLElement | null = null;
  private teacherPanel: HTMLElement | null = null;
  private studentStatus: HTMLElement | null = null;

  constructor() {
    this.networkClient = new NetworkClient();
    this.initializeUI();
  }

  /**
   * Initializes UI elements and event handlers
   */
  private initializeUI(): void {
    // Get UI elements
    this.modeSelect = document.getElementById('mode-select') as HTMLSelectElement;
    this.networkControls = document.getElementById('network-controls');
    this.serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
    this.userNameInput = document.getElementById('user-name') as HTMLInputElement;
    this.connectButton = document.getElementById('connect-button') as HTMLButtonElement;
    this.networkStatus = document.getElementById('network-status');
    this.teacherPanel = document.getElementById('teacher-panel');
    this.studentStatus = document.getElementById('student-status');

    // Mode selection handler
    if (this.modeSelect) {
      this.modeSelect.addEventListener('change', () => {
        this.handleModeChange(this.modeSelect!.value as ClientMode);
      });
    }

    // Connect button handler
    if (this.connectButton) {
      this.connectButton.addEventListener('click', () => {
        this.handleConnect();
      });
    }

    // Setup network client callbacks
    this.setupNetworkCallbacks();

    // Setup teacher controls
    this.setupTeacherControls();
  }

  /**
   * Sets the MIDI engine for output
   */
  setMidiEngine(engine: IMidiEngine): void {
    this.midiEngine = engine;
  }

  /**
   * Sets the current MIDI channel
   */
  setMidiChannel(channel: number): void {
    this.currentChannel = channel;
  }

  /**
   * Handles mode selection change
   */
  private handleModeChange(mode: ClientMode): void {
    this.mode = mode;

    // Show/hide appropriate UI
    if (this.networkControls) {
      this.networkControls.style.display = mode === 'solo' ? 'none' : 'block';
    }
    if (this.teacherPanel) {
      this.teacherPanel.style.display = 'none';
    }
    if (this.studentStatus) {
      this.studentStatus.style.display = 'none';
    }

    // Disconnect if changing modes
    if (this.networkClient.isConnected) {
      this.networkClient.disconnect();
    }
  }

  /**
   * Handles connection button click
   */
  private handleConnect(): void {
    if (this.networkClient.isConnected) {
      this.networkClient.disconnect();
      this.updateNetworkStatus('Disconnected', 'disconnected');
      if (this.connectButton) {
        this.connectButton.textContent = 'Connect';
      }
      return;
    }

    const serverUrl = this.serverUrlInput?.value || 'http://localhost:3000';
    const userName = this.userNameInput?.value || `User${Math.floor(Math.random() * 1000)}`;

    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    this.updateNetworkStatus('Connecting...', 'connecting');
    this.networkClient.connect(serverUrl, this.mode, userName);
  }

  /**
   * Setup network client callbacks
   */
  private setupNetworkCallbacks(): void {
    this.networkClient.setCallbacks({
      onConnected: () => {
        this.updateNetworkStatus('Connected!', 'connected');
        if (this.connectButton) {
          this.connectButton.textContent = 'Disconnect';
        }
      },

      onDisconnected: () => {
        this.updateNetworkStatus('Disconnected', 'disconnected');
        if (this.connectButton) {
          this.connectButton.textContent = 'Connect';
        }
        if (this.teacherPanel) {
          this.teacherPanel.style.display = 'none';
        }
        if (this.studentStatus) {
          this.studentStatus.style.display = 'none';
        }
      },

      onError: (error) => {
        this.updateNetworkStatus(`Error: ${error.message}`, 'disconnected');
        console.error('Network error:', error);
      },

      onWelcome: (msg: WelcomeMessage) => {
        this.handleWelcome(msg);
      },

      onClientListUpdate: (clients: ClientInfo[], sections: Section[]) => {
        this.connectedClients = clients;
        this.sections = sections;
        if (this.mode === 'teacher') {
          this.updateTeacherUI();
        }
      },

      onNoteEvent: (msg: NoteEventMessage) => {
        this.handleRemoteNoteEvent(msg);
      },

      onClockTick: (_msg) => {
        // Clock ticks handled by existing clock sync if needed
        // Could integrate with existing ClockSync module here
      },

      onClientAssigned: (clientId, section, color) => {
        if (clientId === this.networkClient.clientId) {
          this.updateStudentSection(section, color);
        }
      },

      onClientMuted: (clientId, isMuted) => {
        if (clientId === this.networkClient.clientId) {
          this.isMuted = isMuted;
          this.updateStudentMuteStatus(isMuted);
        }
      },
    });
  }

  /**
   * Handles welcome message from server
   */
  private handleWelcome(msg: WelcomeMessage): void {
    this.connectedClients = msg.allClients;
    this.sections = msg.sections;

    if (this.mode === 'teacher') {
      if (this.teacherPanel) {
        this.teacherPanel.style.display = 'block';
      }
      this.updateTeacherUI();
    } else if (this.mode === 'student') {
      if (this.studentStatus) {
        this.studentStatus.style.display = 'block';
      }
      this.updateStudentSection(msg.clientInfo.section, msg.clientInfo.color);
      this.updateStudentMuteStatus(msg.clientInfo.isMuted);
    }
  }

  /**
   * Updates network status display
   */
  private updateNetworkStatus(message: string, status: 'connected' | 'disconnected' | 'connecting'): void {
    if (this.networkStatus) {
      this.networkStatus.textContent = message;
      this.networkStatus.className = status;
    }
  }

  /**
   * Updates student section display
   */
  private updateStudentSection(section: string, color: string): void {
    const sectionName = document.getElementById('student-section-name');
    const sectionBadge = document.querySelector('.student-section-badge') as HTMLElement;

    if (sectionName) {
      sectionName.textContent = section;
    }
    if (sectionBadge) {
      sectionBadge.style.backgroundColor = color;
    }
  }

  /**
   * Updates student mute status
   */
  private updateStudentMuteStatus(muted: boolean): void {
    const muteIndicator = document.getElementById('student-mute-indicator');
    if (muteIndicator) {
      muteIndicator.style.display = muted ? 'block' : 'none';
    }
  }

  /**
   * Updates teacher UI with client list and sections
   */
  private updateTeacherUI(): void {
    this.updateSectionsList();
    this.updateStudentsList();
  }

  /**
   * Updates sections list in teacher panel
   */
  private updateSectionsList(): void {
    const sectionsList = document.getElementById('sections-list');
    if (!sectionsList) return;

    sectionsList.innerHTML = '';

    this.sections.forEach(section => {
      const sectionItem = document.createElement('div');
      sectionItem.className = 'section-item';
      sectionItem.style.borderLeftColor = section.color;

      sectionItem.innerHTML = `
        <div class="section-info">
          <div class="section-name">${section.name}</div>
          <div class="section-count">${section.clientIds.length} students</div>
        </div>
        <div class="section-controls">
          <button onclick="window.collabController?.muteSection('${section.id}', ${!section.isMuted})">
            ${section.isMuted ? '🔊 Unmute' : '🔇 Mute'}
          </button>
        </div>
      `;

      sectionsList.appendChild(sectionItem);
    });
  }

  /**
   * Updates students list in teacher panel
   */
  private updateStudentsList(): void {
    const studentsList = document.getElementById('students-list');
    const studentCount = document.getElementById('student-count');

    if (!studentsList) return;

    const students = this.connectedClients.filter(c => c.mode === 'student');

    if (studentCount) {
      studentCount.textContent = students.length.toString();
    }

    studentsList.innerHTML = '';

    if (students.length === 0) {
      studentsList.innerHTML = '<div style="text-align: center; opacity: 0.5;">No students connected</div>';
      return;
    }

    students.forEach(student => {
      const studentItem = document.createElement('div');
      studentItem.className = 'student-item';
      if (student.isMuted) {
        studentItem.classList.add('muted');
      }
      studentItem.style.borderLeftColor = student.color;

      const notesText = student.activeNotes.length > 0
        ? student.activeNotes.map(n => this.midiNoteToName(n)).join(', ')
        : '—';

      studentItem.innerHTML = `
        <div class="student-info">
          <div class="student-name">${student.name}</div>
          <div class="student-notes">${notesText}</div>
          <div style="font-size: 0.8em; opacity: 0.7;">${student.section}</div>
        </div>
        <div class="student-controls">
          <button onclick="window.collabController?.muteStudent('${student.id}', ${!student.isMuted})">
            ${student.isMuted ? '🔊' : '🔇'}
          </button>
          <select onchange="window.collabController?.assignStudent('${student.id}', this.value)">
            ${this.sections.map(s =>
              `<option value="${s.id}" ${s.id === student.section ? 'selected' : ''}>${s.name}</option>`
            ).join('')}
          </select>
        </div>
      `;

      studentsList.appendChild(studentItem);
    });
  }

  /**
   * Setup teacher control handlers
   */
  private setupTeacherControls(): void {
    // Expose controller to window for button onclick handlers
    (window as any).collabController = this;

    const startClockBtn = document.getElementById('teacher-start-clock');
    const stopClockBtn = document.getElementById('teacher-stop-clock');
    const muteAllBtn = document.getElementById('teacher-mute-all');
    const setBPMBtn = document.getElementById('teacher-set-bpm');
    const bpmInput = document.getElementById('teacher-bpm') as HTMLInputElement;

    if (startClockBtn) {
      startClockBtn.addEventListener('click', () => {
        this.networkClient.startClock();
      });
    }

    if (stopClockBtn) {
      stopClockBtn.addEventListener('click', () => {
        this.networkClient.stopClock();
      });
    }

    if (muteAllBtn) {
      muteAllBtn.addEventListener('click', () => {
        this.connectedClients
          .filter(c => c.mode === 'student')
          .forEach(student => {
            this.networkClient.muteClient(student.id, true);
          });
      });
    }

    if (setBPMBtn && bpmInput) {
      setBPMBtn.addEventListener('click', () => {
        const bpm = parseInt(bpmInput.value);
        if (bpm >= 40 && bpm <= 300) {
          this.networkClient.setBPM(bpm);
        }
      });
    }
  }

  /**
   * Teacher command: Mute/unmute student
   */
  muteStudent(clientId: string, muted: boolean): void {
    this.networkClient.muteClient(clientId, muted);
  }

  /**
   * Teacher command: Mute/unmute section
   */
  muteSection(sectionId: string, muted: boolean): void {
    this.networkClient.muteSection(sectionId, muted);
  }

  /**
   * Teacher command: Assign student to section
   */
  assignStudent(clientId: string, sectionId: string): void {
    this.networkClient.assignSection(clientId, sectionId);
  }

  /**
   * Sends note on event to server
   */
  sendNoteOn(note: number, velocity: number): void {
    if (!this.networkClient.isConnected) return;
    if (this.mode === 'student' && this.isMuted) return; // Don't send if muted

    this.networkClient.sendNoteOn(note, velocity);
  }

  /**
   * Sends note off event to server
   */
  sendNoteOff(note: number): void {
    if (!this.networkClient.isConnected) return;
    if (this.mode === 'student' && this.isMuted) return; // Don't send if muted

    this.networkClient.sendNoteOff(note);
  }

  /**
   * Handles note events from other clients
   */
  private handleRemoteNoteEvent(msg: NoteEventMessage): void {
    // Skip our own notes
    if (msg.clientId === this.networkClient.clientId) return;

    // Find the client's info for color
    const client = this.connectedClients.find(c => c.id === msg.clientId);
    if (!client) return;

    // Skip if client is muted
    if (client.isMuted) return;

    // Teacher outputs all notes to MIDI
    if (this.mode === 'teacher' && this.midiEngine) {
      if (msg.isNoteOn) {
        this.midiEngine.playNote(msg.note, msg.velocity, this.currentChannel);
      } else {
        this.midiEngine.stopNote(msg.note, 0, this.currentChannel);
      }
    }

    // Visual feedback for all clients
    this.updateRemoteNoteVisual(msg.note, msg.isNoteOn, client.color);
  }

  /**
   * Updates piano visual for remote note
   */
  private updateRemoteNoteVisual(note: number, isActive: boolean, color: string): void {
    // Find piano key element
    const piano = document.getElementById('piano');
    if (!piano) return;

    const keys = piano.querySelectorAll('.key');
    keys.forEach(key => {
      const keyNote = parseInt(key.getAttribute('data-note') || '-1');
      if (keyNote === note) {
        if (isActive) {
          key.classList.add('client-note');
          (key as HTMLElement).style.color = color;
        } else {
          key.classList.remove('client-note');
          (key as HTMLElement).style.color = '';
        }
      }
    });
  }

  /**
   * Converts MIDI note to name (C4, D#5, etc.)
   */
  private midiNoteToName(note: number): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(note / 12) - 1;
    const noteName = names[note % 12];
    return `${noteName}${octave}`;
  }

  /**
   * Checks if in collaborative mode
   */
  isCollaborative(): boolean {
    return this.mode !== 'solo' && this.networkClient.isConnected;
  }

  /**
   * Gets current mode
   */
  getMode(): ClientMode {
    return this.mode;
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    if (this.networkClient.isConnected) {
      this.networkClient.disconnect();
    }
    // Remove global reference
    delete (window as any).collabController;
  }
}
