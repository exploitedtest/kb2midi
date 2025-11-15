# Arpeggiator Plugin Exploration

## Executive Summary

This document explores spinning off kb2midi's arpeggiator logic into standalone plugins:
1. **Max for Live Device** - MIDI effect for Ableton Live users
2. **VST/AU Plugin** - Cross-DAW compatible MIDI effect

Both approaches are **feasible** with different implementation strategies and tradeoffs. The Max for Live approach has a **faster time-to-market** but is **Live-only**, while the VST approach requires more infrastructure but achieves **universal DAW compatibility**.

---

## Current Implementation Analysis

### Core Arpeggiator Features (src/arpeggiator.ts:1-528)

The existing TypeScript implementation includes:

**Pattern Engine**
- 8 patterns: up, down, up-down, down-up, random, chord, stacked-chord, timeline
- Octave range (1-4 octaves)
- Note order management with press-order preservation
- Sliding window mode (notesPerStep, slidingOverlap)

**Timing & Sync**
- External MIDI clock synchronization (ClockSync integration)
- Clock divisions: quarter, 8th, 16th, 32nd notes
- Swing/shuffle (0-1 range)
- Gate length control (0-1 range)
- BPM detection from MIDI clock ticks

**State Management**
- Note tracking (addNote, removeNote, clearNotes)
- Press order preservation for timeline pattern
- Active timeout management for gate timing
- Per-note/per-channel tracking to prevent overlaps

**MIDI Integration**
- Receives MIDI clock (0xF8), Start (0xFA), Stop (0xFC), Continue (0xFB)
- Sends Note On/Off with velocity and channel
- Live parameter integration (channel, velocity from UI)

### Dependencies & Architecture

**ClockSync Module** (src/clock-sync.ts:1-202)
- MIDI clock tick processing (24 PPQN)
- BPM detection with averaging (3+ samples)
- Start/Stop/Continue message handling
- Timeout-based clock stop detection (500ms)
- Event callbacks: onTick, onQuarterNote, onSixteenthNote, onStart, onStop

**Type System** (src/types.ts:47-60, 159-165)
```typescript
interface ArpeggiatorState {
  enabled: boolean;
  pattern: ArpeggiatorPattern;
  rate: number;
  gateLength: number;
  swing: number;
  octaveRange: number;
  noteOrder: number[];
  currentStep: number;
  syncToClock: boolean;
  clockDivisor: number;
  notesPerStep: number;
  slidingOverlap: boolean;
}

interface IMidiEngine {
  playNote(note: number, velocity: number, channel: number): void;
  stopNote(note: number, velocity: number, channel: number): void;
}
```

**Key Architectural Patterns**
- Event-driven coordination via callbacks
- State management with controlled access
- MIDI message abstraction layer
- Clock-driven sequencing (not timeout-based)

---

## Option 1: Max for Live Device

### Overview

Max for Live (M4L) allows creating native MIDI effects for Ableton Live using Max's visual programming environment with JavaScript support via the `v8` object (Max 9+).

### Technical Approach

**Architecture: Max Patcher + JavaScript**

```
┌─────────────────────────────────────┐
│   Max for Live Device (.amxd)       │
├─────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────┐ │
│  │  Max Patcher │  │  v8 Object  │ │
│  │   (MIDI I/O) │◄─┤ (Arp Logic)│ │
│  └──────────────┘  └─────────────┘ │
│         ▲                ▲          │
│         │                │          │
│   ┌─────┴────┐    ┌─────┴──────┐  │
│   │ UI Panel │    │ Parameters │  │
│   └──────────┘    └────────────┘  │
└─────────────────────────────────────┘
```

**Component Breakdown**

1. **Max Patcher (Visual Patching)**
   - `midiin` / `midiout` objects for MIDI I/O
   - `midirealtimein` for clock messages (0xF8, 0xFA, 0xFC, 0xFB)
   - `live.dial`, `live.menu`, `live.toggle` for UI controls
   - `v8` object to run JavaScript arpeggiator engine
   - `route` and `pak`/`unpack` for MIDI message routing

2. **JavaScript Engine (v8 Object)**
   - Port `arpeggiator.ts` core logic to JavaScript
   - Port `clock-sync.ts` for timing
   - Expose functions: `addNote()`, `removeNote()`, `setPattern()`, etc.
   - Emit MIDI via Max outlet messages

3. **Live API Integration (Optional)**
   - Access Live's transport for sync
   - Parameter automation mapping
   - Preset management via Live's system

### Implementation Strategy

**Phase 1: Core Port (Week 1-2)**
```javascript
// In v8 object
class M4LArpeggiator {
  constructor() {
    this.state = {
      enabled: false,
      pattern: 'up',
      gateLength: 0.5,
      // ... rest of state
    };
    this.clockSync = new ClockSync();
    this.pressOrder = [];
  }

  // Called from Max inlet 0 (MIDI notes)
  handleNoteIn(pitch, velocity) {
    if (velocity > 0) this.addNote(pitch);
    else this.removeNote(pitch);
  }

  // Called from Max inlet 1 (clock messages)
  handleClockTick() {
    this.clockSync.onMIDIClockTick();
  }

  // Output to Max outlet 0 (MIDI notes)
  playNoteWithGate(note, velocity, channel, gateTime) {
    outlet(0, note, velocity); // Note on

    const task = new Task(() => {
      outlet(0, note, 0); // Note off
    });
    task.schedule(gateTime);
  }
}
```

**Phase 2: Max Patcher UI (Week 2-3)**
- Design panel layout with Live UI objects
- Connect dials/menus to v8 parameters
- Create parameter mapping for automation
- Add preset system

**Phase 3: Testing & Polish (Week 3-4)**
- Test with various DAW tempos and clock sources
- Verify note-off cleanup on device disable
- Test preset saving/loading
- Create documentation and demo project

### Code Portability Assessment

**Direct Ports (90% reusable)**
- Pattern algorithms (up, down, up-down, etc.) - Pure JavaScript
- Note order calculation - Pure JavaScript
- State management - Pure JavaScript
- BPM detection logic - Pure JavaScript

**Adaptations Required (10% rewrite)**
- **MIDI I/O**: Web MIDI API → Max inlet/outlet messages
- **Timing**: `setTimeout` → Max's `Task` object
- **Clock Input**: ClockSync callbacks → Max `midirealtimein` routing
- **Parameter Access**: Getter functions → Max message routing

**Example Adaptation**
```javascript
// Before (Web MIDI)
this.midiEngine.playNote(note, velocity, channel);

// After (Max)
outlet(0, 'note', note, velocity, channel);
```

### Pros & Cons

**Pros**
- ✅ **Fast Development**: JavaScript port + visual patching (4-6 weeks)
- ✅ **Native Integration**: Works seamlessly in Live's MIDI signal chain
- ✅ **UI Consistency**: Live.* UI objects match Ableton's look
- ✅ **Built-in Sync**: Automatic clock sync with Live's transport
- ✅ **Preset System**: Free preset management via Live
- ✅ **Code Reuse**: 90% of existing TypeScript logic directly portable
- ✅ **No Compilation**: JavaScript runs directly in v8 engine

**Cons**
- ❌ **Live-Only**: Not usable in other DAWs (Logic, FL Studio, Cubase, etc.)
- ❌ **Max License**: Requires Max 9 (bundled with Live 12.2+, or standalone $399)
- ❌ **Timing Concerns**: JavaScript runs in low-priority thread (not ideal for live performance)
- ❌ **Distribution**: Users need Live Suite or Max for Live add-on
- ❌ **Platform**: Max 9 Monaco editor only on macOS (as of April 2025)

### Development Timeline

**Total: 4-6 weeks**
- Week 1: Port arpeggiator.ts and clock-sync.ts to v8 JavaScript
- Week 2: Build Max patcher with MIDI routing and basic UI
- Week 3: Add Live UI objects, parameter automation, presets
- Week 4: Testing, bug fixes, documentation
- Week 5-6: Polish, demo projects, user testing

### Distribution

- Export as `.amxd` file
- Distribute via maxforlive.com (free or paid)
- Or sell on Gumroad, Isotonik Studios, etc.
- Users need Live Suite or Max for Live add-on ($99)

---

## Option 2: VST/AU Plugin

### Overview

Create a cross-platform MIDI effect plugin in VST3/AU/CLAP formats, usable in all major DAWs (Ableton, Logic, FL Studio, Cubase, Bitwig, Reaper, etc.).

### Technical Approach Options

#### A. JUCE Framework (C++ - Industry Standard)

**Architecture**
```
┌─────────────────────────────────────┐
│       VST3/AU Plugin                │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │   JUCE PluginProcessor       │  │
│  │  (C++ MIDI Processing)       │  │
│  │                               │  │
│  │  - processBlock()             │  │
│  │  - MIDI buffer handling       │  │
│  │  - Parameter management       │  │
│  └──────────────────────────────┘  │
│              ▲                      │
│              │                      │
│  ┌──────────────────────────────┐  │
│  │   JUCE PluginEditor          │  │
│  │  (GUI - JUCE Components or   │  │
│  │   React/TypeScript UI)       │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Implementation**
- Rewrite arpeggiator logic in C++
- Use JUCE's `MidiBuffer` for note processing
- Sync to DAW's transport and tempo
- Build VST3, AU, CLAP from single codebase

**Code Reuse**: ~5% (algorithms only, full rewrite required)

**Pros**
- ✅ **Industry Standard**: JUCE is used by professional plugin developers
- ✅ **Universal**: Works in all DAWs on Windows, macOS, Linux
- ✅ **Performance**: C++ runs in audio thread, perfect timing
- ✅ **Commercial Ready**: Code signing, licensing, copy protection available
- ✅ **Rich Ecosystem**: Many JUCE libraries and examples

**Cons**
- ❌ **Steep Learning Curve**: Requires C++ expertise
- ❌ **Full Rewrite**: TypeScript → C++ port (minimal code reuse)
- ❌ **Build Complexity**: CMake, Xcode, Visual Studio projects
- ❌ **Timeline**: 3-6 months for full implementation

#### B. Elementary Framework (JavaScript - Experimental)

**Architecture**
```
┌─────────────────────────────────────┐
│       VST3/AU Plugin                │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │   Elementary Runtime         │  │
│  │  (Native C++ Core)           │  │
│  │         ▲                     │  │
│  │         │                     │  │
│  │  ┌──────┴──────────────────┐ │  │
│  │  │  JavaScript/TypeScript  │ │  │
│  │  │  (Arp Logic from .ts)   │ │  │
│  │  └─────────────────────────┘ │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Implementation**
- Port existing TypeScript to Elementary's API
- JavaScript runs inside plugin's embedded V8 engine
- Elementary handles plugin wrapper generation

**Code Reuse**: ~70% (most TypeScript logic portable)

**Pros**
- ✅ **High Code Reuse**: Leverage existing TypeScript/JavaScript
- ✅ **Faster Development**: No C++ required
- ✅ **Modern Tooling**: npm, TypeScript, React for UI

**Cons**
- ❌ **Experimental**: Elementary is early-stage technology
- ❌ **macOS/Windows Only**: Linux support unclear
- ❌ **Performance**: JavaScript overhead vs. native C++
- ❌ **Limited Resources**: Smaller community, fewer examples

#### C. Hybrid JUCE + Web UI (TypeScript UI + C++ Engine)

**Architecture**
```
┌─────────────────────────────────────┐
│       VST3/AU Plugin                │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │   JUCE PluginProcessor (C++) │  │
│  │  - Arpeggiator engine         │  │
│  │  - MIDI processing            │  │
│  └──────────────┬───────────────┘  │
│                 │                   │
│  ┌──────────────▼───────────────┐  │
│  │  juce_browser_integration    │  │
│  │  (IPC Bridge)                 │  │
│  └──────────────┬───────────────┘  │
│                 │                   │
│  ┌──────────────▼───────────────┐  │
│  │   React/TypeScript UI        │  │
│  │  (Served via embedded web)   │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Implementation**
- C++ arpeggiator engine (port from TypeScript)
- TypeScript UI using React (reuse UI concepts)
- Bridge via `juce_browser_integration` module

**Code Reuse**: ~30% (UI concepts, algorithms)

**Pros**
- ✅ **Modern UI**: Use React, TypeScript, CSS for interface
- ✅ **Native Performance**: C++ audio processing
- ✅ **Familiar Tools**: Web development stack for UI

**Cons**
- ❌ **Complexity**: Maintain C++ and TypeScript codebases
- ❌ **IPC Overhead**: Bridge communication between C++ and JS
- ❌ **Still Requires C++**: Core engine must be in C++

### Implementation Strategy (JUCE Recommended)

**Phase 1: Core Engine (Weeks 1-4)**
```cpp
// JuceArpeggiator.h
class JuceArpeggiator {
public:
  void processBlock(juce::MidiBuffer& midiBuffer,
                    juce::AudioPlayHead* playHead);
  void addNote(int note);
  void removeNote(int note);
  void setPattern(Pattern pattern);

private:
  void playCurrentStep(juce::MidiBuffer& buffer, int sampleOffset);
  void advanceStep();

  std::vector<int> pressOrder;
  std::vector<int> noteOrder;
  int currentStep = 0;
  // ... rest of state
};
```

**Phase 2: Plugin Wrapper (Weeks 5-6)**
```cpp
class ArpeggiatorProcessor : public juce::AudioProcessor {
public:
  void processBlock(juce::AudioBuffer<float>& buffer,
                   juce::MidiBuffer& midiMessages) override {
    auto playHead = getPlayHead();
    arpeggiator.processBlock(midiMessages, playHead);
  }

private:
  JuceArpeggiator arpeggiator;
  juce::AudioProcessorValueTreeState parameters;
};
```

**Phase 3: UI & Parameters (Weeks 7-10)**
- Build GUI with JUCE components or web UI
- Map parameters to DAW automation
- Create preset system

**Phase 4: Testing & Distribution (Weeks 11-12)**
- Test in multiple DAWs
- Code signing (macOS/Windows)
- Create installer packages

### Code Portability Assessment

**Algorithms (Portable Concepts)**
- Pattern generation logic → Direct port to C++
- Clock division math → Direct port to C++
- Gate time calculation → Direct port to C++

**Full Rewrite Required**
- MIDI I/O (Web MIDI → JUCE MidiBuffer)
- Timing (setTimeout → sample-accurate timing in processBlock)
- Clock sync (Web MIDI clock → DAW transport via AudioPlayHead)
- UI (DOM → JUCE Components or web view)

**Example Adaptation**
```cpp
// Before (TypeScript)
setTimeout(() => {
  this.midiEngine.stopNote(note, 0, channel);
}, gateTime);

// After (C++)
void processBlock(MidiBuffer& buffer, AudioPlayHead* playHead) {
  auto posInfo = playHead->getPosition();
  auto samplesPerBeat = sampleRate * 60.0 / posInfo->bpm;
  auto stepSamples = samplesPerBeat / clockDivisor;

  if (currentSample >= nextStepSample) {
    playCurrentStep(buffer, sampleOffset);
    nextStepSample += stepSamples;
  }
}
```

### Pros & Cons

**Pros**
- ✅ **Universal DAW Support**: Works everywhere (Ableton, Logic, FL, Cubase, Bitwig, etc.)
- ✅ **Professional Grade**: Sample-accurate timing, low latency
- ✅ **Commercial Viability**: Sellable product with licensing
- ✅ **Performance**: Native C++ audio thread processing
- ✅ **Platform Support**: Windows, macOS, Linux
- ✅ **Modern Formats**: VST3, AU, CLAP

**Cons**
- ❌ **Long Timeline**: 3-6 months minimum
- ❌ **C++ Expertise Required**: Steep learning curve
- ❌ **Low Code Reuse**: ~5% of existing code portable
- ❌ **Build Complexity**: Multi-platform build system
- ❌ **Cost**: Potential JUCE license fee ($50/mo for Pro features)

### Development Timeline

**Total: 3-6 months**
- Weeks 1-4: Port arpeggiator core to C++
- Weeks 5-6: JUCE plugin wrapper, parameters
- Weeks 7-10: UI design and implementation
- Weeks 11-12: Testing, code signing, installers
- Ongoing: Bug fixes, updates

### Distribution

- Sell via Plugin Boutique, Splice, Gumroad
- Pricing: $19-49 typical for MIDI effect plugins
- Code signing required (Apple $99/year, Windows varies)
- Copy protection via JUCE or third-party (e.g., PACE, Arturia)

---

## Recommendation Matrix

| Criterion | Max for Live | VST/AU (JUCE) | VST/AU (Elementary) |
|-----------|--------------|---------------|---------------------|
| **Development Time** | 4-6 weeks | 3-6 months | 2-4 months |
| **Code Reuse** | 90% | 5% | 70% |
| **DAW Support** | Live only | All DAWs | All DAWs |
| **Performance** | Good (low-priority thread) | Excellent (audio thread) | Good (V8 engine) |
| **C++ Required?** | No | Yes | No |
| **Commercial Viability** | Medium (Live users only) | High (universal) | Low (experimental) |
| **Learning Curve** | Low | High | Medium |
| **Distribution** | maxforlive.com | Plugin stores | Plugin stores |

---

## Strategic Recommendations

### Short-Term (Now - 3 months)

**Build Max for Live Device First**

**Rationale**
1. **Fastest Time-to-Market**: 4-6 weeks vs. 3-6 months
2. **Validate Product**: Test market demand with Live users
3. **Leverage Existing Code**: 90% code reuse from kb2midi
4. **Immediate Revenue**: Start selling on maxforlive.com
5. **Build Audience**: Establish user base for future VST

**Action Steps**
1. Create new repository: `kb2midi-arp-m4l`
2. Port `arpeggiator.ts` and `clock-sync.ts` to v8 JavaScript
3. Build Max patcher with MIDI I/O and UI
4. Test with Ableton Live 12.2+ (Max 9)
5. Create demo project and documentation
6. Launch on maxforlive.com and social media

**Success Metrics**
- 100+ downloads in first month
- Positive user feedback
- Feature requests for VST version

### Medium-Term (3-12 months)

**Build VST/AU Plugin with JUCE**

**Rationale**
1. **Market Validation**: M4L device proves demand
2. **Revenue Expansion**: Reach Logic, FL Studio, Cubase users
3. **Professional Product**: Commercial-grade plugin
4. **Learning from M4L**: Incorporate user feedback into VST design

**Action Steps**
1. Learn JUCE framework (or hire C++ developer)
2. Create new repository: `kb2midi-arp-vst`
3. Port arpeggiator logic to C++ using M4L learnings
4. Build cross-platform UI
5. Test in multiple DAWs
6. Code sign and package for distribution
7. Launch on Plugin Boutique, Splice, etc.

**Success Metrics**
- 500+ sales in first 6 months
- 4.5+ star average rating
- Positive reviews from users and YouTube channels

### Long-Term (12+ months)

**Ecosystem Expansion**

- **Standalone App**: Electron-based standalone version (reuse kb2midi codebase)
- **iOS/Android**: Mobile MIDI arpeggiator apps
- **Additional M4L Devices**: Other kb2midi features as M4L devices (clock sync, velocity curves, etc.)
- **VST Suite**: Bundle arpeggiator with other MIDI effects

---

## Technical Considerations

### MIDI Clock Sync

**Max for Live**
- Use `midirealtimein` object to receive clock (0xF8)
- Alternatively, use Live.transport API for easier sync
- Live's transport provides bar/beat/tick position directly

**VST/AU**
- Use `AudioPlayHead::getPosition()` for BPM and bar/beat
- Calculate step timing from sample rate and BPM
- No explicit MIDI clock needed (DAW provides timing)

### Pattern Algorithms (Portable)

Both implementations can reuse these algorithms directly:

```javascript
// Timeline pattern (press order)
noteOrder = [...pressOrder];

// Up pattern (sorted ascending)
noteOrder = [...pressOrder].sort((a, b) => a - b);

// Down pattern (sorted descending)
noteOrder = [...pressOrder].sort((a, b) => b - a);

// Up-Down (pingpong with no endpoint duplication)
const sorted = [...pressOrder].sort((a, b) => a - b);
noteOrder = [...sorted, ...sorted.slice(1, -1).reverse()];

// Random (shuffled)
noteOrder = [...pressOrder].sort(() => Math.random() - 0.5);
```

### Gate Timing

**Max for Live (Task object)**
```javascript
const task = new Task(() => {
  outlet(0, note, 0); // Note off
}, this);
task.schedule(gateTimeMs);
```

**VST/AU (Sample-accurate)**
```cpp
void scheduleNoteOff(int note, int channel, double gateBeats) {
  auto playHead = getPlayHead();
  auto samplesPerBeat = sampleRate * 60.0 / playHead->bpm;
  auto gatesamples = gateBeats * samplesPerBeat;

  scheduledNoteOffs.push({
    note: note,
    channel: channel,
    triggerSample: currentSample + gatesamples
  });
}
```

### UI Parameters

**Max for Live**
- `live.dial` → gateLength, swing, octaveRange
- `live.menu` → pattern selection
- `live.toggle` → enable/disable
- `live.text` → BPM display
- All parameters auto-map to Live's automation

**VST/AU**
- `juce::AudioParameterFloat` → gateLength, swing
- `juce::AudioParameterInt` → octaveRange, clockDivisor
- `juce::AudioParameterChoice` → pattern selection
- `juce::AudioParameterBool` → enable/disable
- Manual UI binding to parameters

---

## Competitive Analysis

### Existing Arpeggiator Plugins

**Max for Live**
- Ableton's built-in Arpeggiator (free with Live Suite)
- UArp ($39) - Unlimited arpeggiator/sequencer
- Arpex ($19) - MPE expressive arpeggiator
- Step Arpeggiator ($19) - Pattern-based

**VST/AU**
- BLEASS Arpeggiator ($29) - VST/AU with MPE support
- Cthulhu ($69) - Arpeggiator + chord memorizer
- BlueARP ($29) - Step sequencer + arpeggiator
- HY-Plugins HY-MBMFX ($29) - MIDI effect bundle

### Differentiation Opportunities

**From kb2midi's Unique Features**
1. **Sliding Window Mode** (notesPerStep, slidingOverlap) - Not common in other arps
2. **Timeline Pattern** - Press-order preservation (rare)
3. **Stacked Chord** - Multi-octave chord layering
4. **Clean UI/UX** - kb2midi's minimalist design
5. **Open Source Heritage** - Transparency, community-driven development

**Potential Additions**
- MPE support (per-note pitch bend, pressure)
- MIDI CC modulation per step
- Probability/randomness per step
- Ratcheting (note repeats)
- Step length variation
- Velocity curves per step

---

## Next Steps

### Immediate Actions (This Week)

1. **Choose Initial Path**: Max for Live (recommended) or VST/AU
2. **Set Up Development Environment**
   - Max for Live: Install Max 9, create new Audio Effect project
   - VST/AU: Install JUCE, CMake, C++ compiler
3. **Create Repository**: `kb2midi-arp-m4l` or `kb2midi-arp-vst`
4. **Port Core Logic**: Start with arpeggiator.ts → JavaScript or C++

### Week 1 Milestones

**Max for Live Track**
- [ ] v8 object with basic arpeggiator class
- [ ] MIDI note input/output working
- [ ] Pattern selection (up, down, up-down)
- [ ] Basic Max patcher layout

**VST/AU Track**
- [ ] JUCE project created (VST3, AU targets)
- [ ] Empty plugin loads in DAW
- [ ] MIDI passthrough working
- [ ] Basic parameter setup (pattern, gate, octave)

### Month 1 Goals

**Max for Live**
- Working arpeggiator with all patterns
- Clock sync integration
- Basic UI with Live.* objects
- Alpha testing with Ableton Live users

**VST/AU**
- Core arpeggiator engine in C++
- DAW transport sync working
- Headless version tested in multiple DAWs
- UI framework selected (JUCE or web)

---

## Resources

### Max for Live Development

**Official Documentation**
- [Max 9 Documentation](https://docs.cycling74.com/max9)
- [JavaScript in Max](https://docs.cycling74.com/max9/vignettes/js_live_api)
- [Live API Reference](https://docs.cycling74.com/max9/vignettes/live_api_overview)

**Tutorials**
- [Adam Murray's Blog - JavaScript in Ableton Live](https://adammurray.link/max-for-live/js-in-live/getting-started/)
- [JS Live API Tutorials](https://vstopia.github.io/JS-Live-API/)
- [Build Your Own Max For Live Devices](https://elphnt.io/build-your-own-max-for-live-devices/)

**Examples**
- [midi-thru-js-fn](https://github.com/jsnelgro/midi-thru-js-fn) - MIDI processor template
- [js-live-api-humanize-midi-clips](https://github.com/adamjmurray/js-live-api-humanize-midi-clips) - Live API example

### VST/AU Development

**JUCE Framework**
- [JUCE Tutorials](https://juce.com/tutorials/)
- [Create a basic Audio/MIDI plugin](https://juce.com/tutorials/tutorial_create_projucer_basic_plugin/)
- [Plugin Examples](https://docs.juce.com/master/tutorial_plugin_examples.html)

**Alternative Frameworks**
- [Elementary Audio](https://www.elementary.audio/) - JavaScript audio plugins
- [iPlug2](https://iplug2.github.io/) - C++ plugin framework
- [DPF](https://github.com/DISTRHO/DPF) - DISTRHO Plugin Framework

**Learning Resources**
- [The Audio Programmer YouTube](https://www.youtube.com/c/TheAudioProgrammer)
- [JUCE Forum](https://forum.juce.com/)
- [Audio Developer Conference talks](https://www.youtube.com/@ADCconf)

### Distribution Platforms

**Max for Live**
- [maxforlive.com](https://maxforlive.com/) - Primary M4L marketplace
- [Isotonik Studios](https://isotonikstudios.com/) - Premium M4L devices

**VST/AU Plugins**
- [Plugin Boutique](https://www.pluginboutique.com/)
- [Splice Plugins](https://splice.com/plugins)
- [Gumroad](https://gumroad.com/) - Direct sales
- [KVR Audio Marketplace](https://www.kvraudio.com/marketplace)

---

## Conclusion

Both approaches are viable with clear tradeoffs:

**Max for Live** = Fast launch, Live-only, high code reuse, lower revenue potential
**VST/AU** = Slow launch, universal, low code reuse, higher revenue potential

**Recommended Strategy**: Build Max for Live first (4-6 weeks), validate market demand, then build VST/AU (3-6 months) to expand reach.

This phased approach minimizes risk, maximizes learning, and creates a sustainable product roadmap from kb2midi's existing arpeggiator technology.

---

**Document Version**: 1.0
**Date**: 2025-11-15
**Author**: Claude Code Analysis
**Repository**: https://github.com/exploitedtest/kb2midi
