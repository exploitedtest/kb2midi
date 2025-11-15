# KB2MIDI Collaborative Server

A Node.js server for classroom collaborative MIDI performance with kb2midi. Enables multiple students to play together with teacher control over sections, muting, and tempo.

## Features

- **WebSocket Communication**: Real-time MIDI note relay using Socket.IO
- **Master Clock Distribution**: Server-side clock at 24ppqn (standard MIDI)
- **Section Management**: Organize students into color-coded sections (Red, Blue, Green, Yellow, Purple, Orange)
- **Teacher Controls**: Mute/unmute individuals or entire sections, assign students, control BPM
- **Auto-balancing**: Automatically distributes students evenly across sections
- **Scalable**: Supports up to 100 concurrent clients (configurable)

## Installation

```bash
cd server
npm install
```

## Running the Server

### Development Mode (with auto-restart)

```bash
npm run dev
```

### Production Mode

```bash
# Build TypeScript
npm run build

# Start server
npm start
```

### Configuration

The server can be configured via environment variables or by modifying `DEFAULT_SERVER_CONFIG` in `shared/types.ts`:

```bash
PORT=3000 npm start
```

**Available Options:**
- `PORT`: Server port (default: 3000)
- `defaultBPM`: Initial tempo (default: 120)
- `maxClients`: Maximum concurrent connections (default: 100)
- `clockTicksPerQuarterNote`: MIDI clock resolution (default: 24)
- `autoAssignSections`: Auto-balance students (default: true)

## Server API

The server communicates via WebSocket messages. All messages are JSON objects with a `type` field.

### Client → Server Messages

```typescript
// Join the session
{ type: 'join', mode: 'teacher' | 'student', name: 'Student Name' }

// Send note events
{ type: 'noteOn', note: 60, velocity: 100 }
{ type: 'noteOff', note: 60 }

// Teacher commands
{ type: 'muteClient', clientId: 'abc123', muted: true }
{ type: 'muteSection', sectionId: 'red', muted: true }
{ type: 'assignSection', clientId: 'abc123', sectionId: 'blue' }
{ type: 'setBPM', bpm: 130 }
{ type: 'startClock' }
{ type: 'stopClock' }
{ type: 'kickClient', clientId: 'abc123' }
```

### Server → Client Messages

```typescript
// Welcome message after joining
{
  type: 'welcome',
  clientId: 'abc123',
  clientInfo: { id, name, mode, color, section, ... },
  sections: [...],
  allClients: [...],
  serverBPM: 120
}

// Client list updates
{ type: 'clientListUpdate', clients: [...], sections: [...] }

// Note events from other clients
{ type: 'noteEvent', clientId: 'xyz', note: 60, velocity: 100, isNoteOn: true, timestamp: 1234 }

// Clock ticks (24 per quarter note)
{ type: 'clockTick', tick: 0-23, bpm: 120, timestamp: 1234 }

// Transport commands
{ type: 'clockTransport', command: 'start' | 'stop' | 'continue', timestamp: 1234 }

// Status updates
{ type: 'clientMuted', clientId: 'abc', isMuted: true }
{ type: 'sectionMuted', sectionId: 'red', isMuted: false }
{ type: 'clientAssigned', clientId: 'abc', section: 'blue', color: '#4444ff' }
{ type: 'bpmChanged', bpm: 140 }
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      KB2MIDI Server                         │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │ Connection Mgmt │  │  Clock Engine   │  │   State    │ │
│  │   (Socket.IO)   │  │   (24 ppqn)     │  │  Manager   │ │
│  └─────────────────┘  └─────────────────┘  └────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │           Message Router & Relay                       ││
│  │  - Teacher commands                                    ││
│  │  - Note events (broadcast except sender)              ││
│  │  - Client filtering (mute states)                     ││
│  └────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
         WebSocket               WebSocket
              │                       │
    ┌─────────▼────────┐    ┌────────▼──────────┐
    │  Teacher Client  │    │  Student Clients  │
    │  (Outputs MIDI)  │    │ (Visual feedback) │
    │                  │    │                   │
    │  ┌────────────┐  │    │   Red Section     │
    │  │  Controls  │  │    │   Blue Section    │
    │  │  - Mute    │  │    │   Green Section   │
    │  │  - Assign  │  │    │   ...             │
    │  │  - BPM     │  │    │                   │
    │  └────────────┘  │    └───────────────────┘
    └──────────────────┘
```

## Network Protocol

All communication uses WebSocket (`socket.io`) over HTTP. The server uses a star topology where all messages flow through the central server:

1. **Teacher connects** → Server starts clock automatically
2. **Students connect** → Auto-assigned to least populated section
3. **Student plays note** → Server broadcasts to all OTHER clients (not sender)
4. **Teacher mutes section** → Server marks all clients in that section as muted
5. **Clock tick** → Server broadcasts tick to all clients every ~20.8ms @ 120 BPM

## Security Considerations

**⚠️ This server is designed for LOCAL NETWORKS (classroom LANs) only.**

- No authentication/authorization implemented
- CORS is set to `*` (accept all origins)
- First teacher to connect has full control
- Only one teacher allowed at a time

For production/internet use, add:
- Authentication (JWT tokens, OAuth, etc.)
- HTTPS/WSS encryption
- Rate limiting
- Input validation
- CORS restrictions to your domain

## Performance

### Optimizations
- Batched client updates
- No database (in-memory state)
- Efficient broadcast (excludes sender)
- Minimal processing per tick

### Scalability
- **Tested**: 30 concurrent clients on local network
- **Theoretical**: 100+ clients (configurable via `maxClients`)
- **Latency**: <50ms on LAN (acceptable for classroom use)

### Resource Usage
- **CPU**: ~5-10% on modern hardware @ 30 clients
- **RAM**: ~50MB base + ~1MB per client
- **Network**: ~1-2 KB/s per client (idle), ~5-10 KB/s (active playing)

## Classroom Setup Guide

### 1. **Prepare the Server**
```bash
# On the teacher's computer or a dedicated classroom server
cd kb2midi/server
npm install
npm run build
npm start
```

The server will display:
```
🎹 KB2MIDI Server running on port 3000
🎵 Default BPM: 120
👥 Max clients: 100
📡 Clock: 24 ppqn
```

### 2. **Find the Server IP Address**

**macOS:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
```

**Linux:**
```bash
ip addr show | grep "inet "
```

Look for the local network IP (usually `192.168.x.x` or `10.x.x.x`).

### 3. **Connect Clients**

On each student's device (tablet/phone/computer):

1. Open kb2midi in a web browser: `http://[SERVER-IP]:8080`
2. Select mode: **Student**
3. Enter server URL: `http://[SERVER-IP]:3000`
4. Enter your name
5. Click **Connect**

You'll be auto-assigned to a color-coded section!

### 4. **Teacher Setup**

On the teacher's device:

1. Open kb2midi: `http://localhost:8080` (or server IP)
2. Select mode: **Teacher**
3. Enter server URL: `http://localhost:3000`
4. Enter your name
5. Click **Connect**
6. Set up virtual MIDI output to connect to school PA/speakers
7. Configure DAW to receive from virtual MIDI port

**Teacher controls appear:**
- Start/Stop Clock
- Mute All
- Set BPM
- Section controls (mute entire sections)
- Individual student controls (mute, reassign section)

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use: `lsof -i :3000` (Mac/Linux) or `netstat -ano | findstr :3000` (Windows)
- Try a different port: `PORT=3001 npm start`

### Clients can't connect
- Verify server is running (check console output)
- Check firewall allows port 3000
- Ensure all devices are on the same network
- Try pinging the server: `ping [SERVER-IP]`
- Check server URL format: `http://192.168.1.100:3000` (not `https://`)

### High latency/lag
- Ensure all devices on same LAN (not Wi-Fi repeater)
- Check network congestion
- Reduce number of concurrent clients
- Use wired Ethernet for teacher's computer

### No audio output
- Only TEACHER client outputs MIDI
- Verify teacher has virtual MIDI port configured
- Check DAW is receiving from correct MIDI port
- Ensure "Teacher" mode is selected, not "Student"

### Clock not syncing
- Teacher must be connected for clock to run
- Check teacher panel shows "▶️ Clock Running"
- Verify clients show clock status indicator

## Development

### Project Structure
```
server/
├── src/
│   └── server.ts          # Main server implementation
├── package.json
├── tsconfig.json
└── README.md

shared/
└── types.ts              # Shared TypeScript types for client/server

src/
├── network-client.ts     # WebSocket client wrapper
└── collaborative-controller.ts  # UI integration
```

### Building
```bash
npm run build              # Compile TypeScript to dist/
npm run type-check         # Check types without compiling
```

### Testing
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Start client dev server
cd ..
npm run dev

# Open multiple browser windows:
# - http://localhost:8080 (Teacher mode)
# - http://localhost:8080 (Student mode) x3
```

## Future Enhancements

- [ ] Recording/playback of sessions
- [ ] Preset section configurations
- [ ] Performance metrics/statistics
- [ ] "Spotlight" mode (solo one student)
- [ ] Export session as MIDI file
- [ ] Web-based server admin panel
- [ ] Authentication & user management
- [ ] Cloud deployment support

## License

MIT
