# KB2MIDI Classroom Guide

Transform your classroom into a collaborative music studio! This guide helps teachers set up and run kb2midi in classroom collaborative mode.

## What is Collaborative Mode?

KB2MIDI collaborative mode allows multiple students to play MIDI instruments together in real-time:

- **Students** use their tablets/phones as MIDI keyboards
- **Teacher** controls all student outputs from one computer
- **Sections** organize students by color (Red, Blue, Green, etc.)
- **One audio output** prevents phase issues - teacher's computer outputs all sound
- **Real-time visualization** - everyone sees who's playing what notes

## Educational Benefits

- **Ensemble Performance**: Students learn to play together in time
- **Visual Feedback**: See other students' notes in real-time
- **Section Work**: Practice parts in color-coded groups
- **Accessible**: No expensive MIDI hardware needed - just tablets!
- **Remote Learning**: Works over local network or internet (with setup)
- **Instant Muting**: Teacher can mute disruptive students or entire sections
- **Tempo Control**: Teacher adjusts BPM in real-time during performance

## Quick Start (15 minutes)

### Prerequisites
- **1 computer** (teacher's machine - runs server + outputs audio)
- **Tablets/phones** (1 per student - any modern browser)
- **Local network** (school WiFi or router)
- **Audio system** (optional - connect teacher computer to PA)
- **DAW software** (GarageBand, Logic, Ableton, etc.) on teacher computer

### Setup Steps

#### 1. Start the Server (Teacher's Computer)

```bash
# Download and install kb2midi (one-time setup)
git clone https://github.com/yourusername/kb2midi.git
cd kb2midi

# Install dependencies
npm install
cd server
npm install
cd ..

# Build the client
npm run build

# Start the server
cd server
npm start
```

You should see:
```
🎹 KB2MIDI Server running on port 3000
```

#### 2. Start the Web Interface

In a new terminal:
```bash
cd kb2midi
npm run dev
```

You should see:
```
  ➜  Local:   http://localhost:8080/
  ➜  Network: http://192.168.1.XXX:8080/
```

**Note the Network IP** - students will use this!

#### 3. Teacher Setup

On the teacher's computer:

1. Open http://localhost:8080
2. Select **Mode: Teacher**
3. Enter **Server URL**: `http://localhost:3000`
4. Enter your name
5. Click **Connect**

The teacher control panel appears!

#### 4. Student Setup

On each student device:

1. Open http://[TEACHER-IP]:8080 (e.g., http://192.168.1.100:8080)
2. Select **Mode: Student**
3. Enter **Server URL**: `http://[TEACHER-IP]:3000`
4. Enter student name
5. Click **Connect**

Students are auto-assigned to sections (Red, Blue, Green, etc.)!

#### 5. Configure Teacher Audio Output

1. Open **Audio MIDI Setup** (macOS) or **MIDI settings** (Windows)
2. Create virtual MIDI port (IAC Driver on Mac, loopMIDI on Windows)
3. Open your DAW (GarageBand, etc.)
4. Create instrument track
5. Set MIDI input to the virtual port
6. Connect computer to classroom speakers/PA

🎵 **Ready to play!**

## Classroom Activities

### Activity 1: Echo Exercise (5 mins)
**Goal**: Students learn to match timing and notes

1. Teacher plays a simple melody (4 notes)
2. Each section echoes back in turn:
   - Unmute Red section → Red plays
   - Mute Red, unmute Blue → Blue plays
   - Mute Blue, unmute Green → Green plays
3. All sections play together at the end

**Teacher Controls**:
- Mute/unmute sections in sequence
- Adjust BPM slower for beginners

### Activity 2: Chord Building (10 mins)
**Goal**: Students understand harmony by building chords

1. Assign each section a note of a C major chord:
   - Red Section: Play middle C (C4)
   - Blue Section: Play E (E4)
   - Green Section: Play G (G4)
2. Unmute sections one at a time to build the chord
3. All play together for full chord

**Teacher Controls**:
- Assign sections to specific notes using section management
- Mute individuals who are off-task

### Activity 3: Round Robin Composition (15 mins)
**Goal**: Collaborative melody creation

1. Set BPM to 80
2. Each student adds 2 notes to build a melody:
   - Student 1: C-D
   - Student 2: E-F
   - Student 3: G-A
   - Continue around the room
3. Repeat the full melody together

**Teacher Controls**:
- Mute all, unmute one student at a time
- Record in DAW for playback

### Activity 4: Section Battle (10 mins)
**Goal**: Performance confidence and musicality

1. Each section prepares a short melody (2 minutes)
2. Sections perform in turn
3. Class votes on best performance

**Teacher Controls**:
- Use section mute to give each group the "stage"
- Adjust BPM if needed

### Activity 5: Full Ensemble (20 mins)
**Goal**: Large group performance

1. Load a backing track in the DAW
2. Assign parts:
   - Red: Bass line
   - Blue: Chord voicing
   - Green: Melody
3. Practice each section separately
4. Unmute all for full ensemble

**Teacher Controls**:
- Mute sections to focus on trouble spots
- Adjust tempo for rehearsal speed

## Teacher Control Panel Guide

```
┌──────────────────────────────────────────┐
│         TEACHER CONTROLS                  │
├──────────────────────────────────────────┤
│                                           │
│  Master Controls                          │
│  [▶️ Start Clock] [⏹️ Stop Clock]         │
│  [🔇 Mute All]                            │
│  BPM: [120] [Set BPM]                     │
│                                           │
├──────────────────────────────────────────┤
│                                           │
│  Sections                                 │
│  🔴 Red Section (8 students) [🔇 Mute]   │
│  🔵 Blue Section (7 students) [🔇 Mute]  │
│  🟢 Green Section (9 students) [🔇 Mute] │
│                                           │
├──────────────────────────────────────────┤
│                                           │
│  Students (24)                            │
│  🔴 Alice [C4, E4] [🔇] [Section: Red ▼] │
│  🔴 Bob [----] [🔇] [Section: Red ▼]     │
│  🔵 Charlie [A3] [🔇] [Section: Blue ▼]  │
│  ...                                      │
│                                           │
└──────────────────────────────────────────┘
```

### Controls Explained

**Master Controls**
- **▶️ Start Clock**: Begin synchronized playback
- **⏹️ Stop Clock**: Stop the master clock
- **🔇 Mute All**: Instantly silence all students (panic button!)
- **BPM**: Set the global tempo (40-300 BPM)

**Section Controls**
- **Section Name**: Shows section color and student count
- **🔇 Mute Button**: Mute/unmute entire section at once

**Individual Student Controls**
- **Student Name**: Shows active notes being played
- **🔇 Button**: Mute/unmute individual student
- **Section Dropdown**: Reassign student to different section

## Classroom Management Tips

### Before Class
- ✅ Test server connection the day before
- ✅ Print IP address on whiteboard
- ✅ Have backup plan if network fails
- ✅ Prepare activity plan with timings

### During Class
- 🎯 Start with simple activities (echo exercise)
- 🎯 Use mute liberally - it's instant and non-confrontational
- 🎯 Give clear instructions before unmuting sections
- 🎯 Monitor student list for disconnections
- 🎯 Adjust BPM as needed (slower for learning, faster for energy)

### Classroom Rules
1. **Muted = Listen**: Students only play when unmuted
2. **Respect Sections**: Stay in your assigned section
3. **Device Management**: Tablets on desk, not in lap
4. **Save Work**: Teacher records in DAW, not on student devices

## Troubleshooting

### Student can't connect
- Verify network name matches (case-sensitive!)
- Check URL format: `http://192.168.1.100:3000` (not `https://`)
- Try reconnecting WiFi on student device
- Refresh browser page

### Lag/latency issues
- Move router closer to classroom
- Reduce number of connected devices on school network
- Use teacher's phone as WiFi hotspot if school network is slow
- Switch to 5GHz WiFi if available

### Student disconnects frequently
- Check device battery level
- Disable "Low Power Mode" on tablets
- Ensure device doesn't auto-lock screen
- Check WiFi signal strength

### No sound output
- Verify DAW is receiving MIDI (check activity indicator)
- Ensure virtual MIDI port is created and online
- Test with teacher playing notes directly
- Check audio output device in DAW preferences

### Disruptive student
- **Quick fix**: Mute individual student immediately
- **Temporary**: Move to different section (physical separation)
- **Last resort**: Kick from server (they can rejoin)

## Technical Requirements

### Teacher Computer
- **OS**: macOS 10.15+, Windows 10+, or Linux
- **RAM**: 8GB minimum (16GB recommended)
- **CPU**: Modern Intel i5 or equivalent
- **Network**: Ethernet connection preferred
- **Software**: Node.js 18+, DAW (GarageBand, Logic, Ableton, FL Studio)

### Student Devices
- **OS**: iOS 12+, Android 8+, ChromeOS, or desktop browser
- **Browser**: Chrome, Safari, or Edge (NOT Firefox - limited Web MIDI support)
- **Screen**: 7" minimum (phones work, tablets better)
- **Network**: WiFi 802.11n or better

### Network
- **Speed**: 10 Mbps minimum, 100 Mbps recommended
- **Latency**: <50ms on local network
- **Setup**: All devices on same network/subnet
- **Ports**: TCP 3000 (server), TCP 8080 (web interface)

## Advanced: Internet/Remote Setup

For distance learning or cross-campus collaboration:

1. **Deploy server to cloud**:
   - Use Heroku, DigitalOcean, or AWS
   - Configure HTTPS/WSS
   - Open firewall ports 3000, 8080

2. **Update client URLs**:
   - Students use public IP: `https://your-server.com:3000`

3. **Accept higher latency**:
   - Internet latency: 50-200ms typical
   - Still usable for non-rhythm-critical activities
   - Not recommended for tight ensemble work

**⚠️ Security Warning**: Add authentication before exposing to internet!

## FAQ

**Q: How many students can connect?**
A: Tested with 30. Server supports up to 100 (configurable).

**Q: Do students need accounts?**
A: No! Just enter a name when connecting.

**Q: Can students hear each other?**
A: No - only teacher outputs audio. Students see visual feedback.

**Q: What if a student plays wrong notes?**
A: Mute them instantly! It's non-disruptive and they stay connected.

**Q: Can I use this without internet?**
A: Yes! Set up a local WiFi router (no internet connection needed).

**Q: Does this work on Chromebooks?**
A: Yes - Chrome browser has full Web MIDI support.

**Q: Can I record the session?**
A: Yes! The DAW on teacher's computer can record everything.

**Q: What if I don't have a DAW?**
A: Use free options: GarageBand (Mac), Cakewalk (Windows), or Reaper (trial).

## Support & Resources

- **Documentation**: See `/server/README.md` for technical details
- **Issues**: Report bugs at GitHub Issues
- **Community**: Share lesson plans and activities!

## License

MIT - Free for educational use

---

**Happy teaching! 🎹🎶**

*Transform your classroom into a digital music ensemble with kb2midi collaborative mode.*
