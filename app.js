/**
 * Application Controller
 * Wires CPUEngine, DatapathView, Code Editor, Registers, Digital Display,
 * Timeline, Execution Log, and RAM Inspector
 */

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate Engine and Datapath
    const cpu = new CPUEngine();
    const datapath = new DatapathView('datapath-container');

    // UI Element References
    const btnRun = document.getElementById('btn-run');
    const btnRunText = document.getElementById('btn-run-text');
    const btnStepMicro = document.getElementById('btn-step-micro');
    const btnStepInstr = document.getElementById('btn-step-instr');
    const btnReset = document.getElementById('btn-reset');
    const btnTriggerIntr = document.getElementById('btn-trigger-intr');
    const btnAssemble = document.getElementById('btn-assemble');
    const btnLoadPreset = document.getElementById('btn-load-preset');
    const btnClearLog = document.getElementById('btn-clear-log');
    const btnOpenTheory = document.getElementById('btn-open-theory');
    const btnCloseTheory = document.getElementById('btn-close-theory');
    const btnModalCloseOk = document.getElementById('btn-modal-close-ok');
    const theoryModal = document.getElementById('theory-modal');

    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    const soundText = document.getElementById('sound-text');

    const presetSelect = document.getElementById('preset-select');
    const speedSlider = document.getElementById('speed-slider');
    const speedLabel = document.getElementById('speed-label');
    const assemblyEditor = document.getElementById('assembly-editor');
    const assemblerStatus = document.getElementById('assembler-status');
    const assemblerStatusText = document.getElementById('assembler-status-text');

    const inputMemSearch = document.getElementById('input-mem-search');
    const tbodyRam = document.getElementById('tbody-ram');
    const memScrollContainer = document.getElementById('mem-scroll-container');
    const logStream = document.getElementById('log-stream');

    // Clock Timer State
    let clockTimer = null;
    let clockFrequencyHz = 20;

    // Web Audio Synthesizer
    class AudioSynth {
        constructor() {
            this.ctx = null;
            this.enabled = true;
        }
        init() {
            if (!this.ctx && typeof AudioContext !== 'undefined') {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        }
        playTick() {
            if (!this.enabled) return;
            try {
                this.init();
                if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, this.ctx.currentTime);
                gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.025);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.025);
            } catch(e) {}
        }
        playOut() {
            if (!this.enabled) return;
            try {
                this.init();
                if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(659.25, this.ctx.currentTime); // E5
                gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.1);
            } catch(e) {}
        }
        playIntr() {
            if (!this.enabled) return;
            try {
                this.init();
                if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.18);
                gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.18);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.18);
            } catch(e) {}
        }
    }
    const synth = new AudioSynth();

    /**
     * Initialize Application
     */
    function init() {
        // Load default selected preset
        loadPreset(presetSelect.value || 'count_sum');

        // Initial UI Render
        updateUI();

        // Setup Event Listeners
        setupEventListeners();
    }

    /**
     * Setup UI Event Listeners
     */
    function setupEventListeners() {
        // Run / Pause
        btnRun.addEventListener('click', toggleClock);

        // Step Micro (T-State)
        btnStepMicro.addEventListener('click', () => {
            pauseClock();
            stepMicroCycle();
        });

        // Step Full Instruction
        btnStepInstr.addEventListener('click', () => {
            pauseClock();
            stepInstructionCycle();
        });

        // Reset
        btnReset.addEventListener('click', () => {
            pauseClock();
            cpu.reset(false);
            addLogEntry('[SYSTEM] CPU registers and cycle state reset.');
            updateUI();
        });

        // Trigger Hardware Interrupt
        btnTriggerIntr.addEventListener('click', () => {
            cpu.triggerInterrupt();
            synth.playIntr();
            btnTriggerIntr.classList.add('active');
            setTimeout(() => btnTriggerIntr.classList.remove('active'), 500);
            updateUI();
        });

        // Assemble Button
        btnAssemble.addEventListener('click', () => {
            assembleAndLoad();
        });

        // Load Preset Button
        btnLoadPreset.addEventListener('click', () => {
            loadPreset(presetSelect.value);
        });

        presetSelect.addEventListener('change', () => {
            loadPreset(presetSelect.value);
        });

        // Sound Toggle
        btnSoundToggle.addEventListener('click', () => {
            synth.enabled = !synth.enabled;
            if (synth.enabled) {
                soundIcon.textContent = '🔊';
                soundText.textContent = 'Sound: ON';
                btnSoundToggle.classList.remove('btn-danger');
            } else {
                soundIcon.textContent = '🔇';
                soundText.textContent = 'Sound: OFF';
                btnSoundToggle.classList.add('btn-danger');
            }
        });

        // Speed Slider
        speedSlider.addEventListener('input', (e) => {
            clockFrequencyHz = parseInt(e.target.value, 10);
            speedLabel.textContent = `${clockFrequencyHz} Hz`;
            if (clockTimer) {
                pauseClock();
                startClock();
            }
        });

        // Search Memory
        inputMemSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = inputMemSearch.value.trim();
                let addr = 0;
                if (query.toLowerCase().startsWith('0x')) {
                    addr = parseInt(query, 16);
                } else {
                    addr = parseInt(query, 10);
                }
                if (!isNaN(addr) && addr >= 0 && addr < cpu.memorySize) {
                    scrollToMemoryAddress(addr);
                }
            }
        });

        // Clear Log
        btnClearLog.addEventListener('click', () => {
            logStream.innerHTML = '';
            addLogEntry('[SYSTEM] Execution trace log cleared.');
        });

        // Modal Controls
        btnOpenTheory.addEventListener('click', () => {
            theoryModal.classList.add('open');
        });

        btnCloseTheory.addEventListener('click', () => {
            theoryModal.classList.remove('open');
        });

        btnModalCloseOk.addEventListener('click', () => {
            theoryModal.classList.remove('open');
        });

        theoryModal.addEventListener('click', (e) => {
            if (e.target === theoryModal) {
                theoryModal.classList.remove('open');
            }
        });

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target === assemblyEditor || e.target === inputMemSearch) return;

            if (e.code === 'Space') {
                e.preventDefault();
                toggleClock();
            } else if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                pauseClock();
                stepMicroCycle();
            } else if (e.key === 'i' || e.key === 'I') {
                e.preventDefault();
                pauseClock();
                stepInstructionCycle();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                pauseClock();
                cpu.reset(false);
                addLogEntry('[SYSTEM] Reset via keyboard shortcut.');
                updateUI();
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                cpu.triggerInterrupt();
                synth.playIntr();
                updateUI();
            }
        });
    }

    /**
     * Start / Pause Execution Clock
     */
    function toggleClock() {
        if (clockTimer) {
            pauseClock();
        } else {
            startClock();
        }
    }

    function startClock() {
        if (cpu.isHalted) {
            cpu.reset(false);
        }
        btnRun.classList.add('running');
        btnRunText.textContent = 'Pause';
        btnRun.querySelector('.btn-icon').textContent = '⏸';

        const intervalMs = Math.max(20, Math.floor(1000 / clockFrequencyHz));
        clockTimer = setInterval(() => {
            const stepped = cpu.stepMicro();
            synth.playTick();
            if (cpu.currentOpcode === 0x11 && cpu.microStepInfo.tStateName === 'T4') {
                synth.playOut();
            }
            updateUI();
            if (!stepped || cpu.isHalted) {
                pauseClock();
            }
        }, intervalMs);
    }

    function pauseClock() {
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
        }
        btnRun.classList.remove('running');
        btnRunText.textContent = 'Run';
        btnRun.querySelector('.btn-icon').textContent = '▶';
    }

    /**
     * Step Micro-Operation (T-State)
     */
    function stepMicroCycle() {
        if (cpu.isHalted) return;
        cpu.stepMicro();
        synth.playTick();
        if (cpu.currentOpcode === 0x11 && cpu.microStepInfo.tStateName === 'T4') {
            synth.playOut();
        }
        updateUI();
    }

    /**
     * Step Instruction Cycle
     */
    function stepInstructionCycle() {
        if (cpu.isHalted) return;
        cpu.stepInstruction();
        updateUI();
    }

    /**
     * Load Preset Program into Editor & Assemble
     */
    function loadPreset(key) {
        pauseClock();
        const preset = PRESET_PROGRAMS[key];
        if (!preset) return;

        assemblyEditor.value = preset.code;
        assembleAndLoad();
        addLogEntry(`[PROGRAM LOADED] "${preset.name}": ${preset.description}`);
    }

    /**
     * Assemble editor text and load into CPU memory
     */
    function assembleAndLoad() {
        pauseClock();
        const source = assemblyEditor.value;
        try {
            const result = cpu.assemble(source);

            // Copy assembled memory to CPU
            cpu.memory.set(result.memory);
            cpu.reset(false);

            // Update Assembler status box
            assemblerStatus.classList.remove('error');
            assemblerStatusText.textContent = `Assembled successfully! Generated ${result.assembledProgram.length} instructions/data words.`;

            // Update RAM Table
            renderRamTable();

            addLogEntry(`[ASSEMBLER] Assembly successful. Loaded ${result.assembledProgram.length} words to RAM.`);
            updateUI();
        } catch (err) {
            assemblerStatus.classList.add('error');
            assemblerStatusText.textContent = `Assemble Error: ${err.message}`;
            addLogEntry(`[ASSEMBLER ERROR] ${err.message}`);
        }
    }

    /**
     * Render RAM Memory Table (all 256 words)
     */
    function renderRamTable() {
        let html = '';
        for (let addr = 0; addr < cpu.memorySize; addr++) {
            const val = cpu.memory[addr];
            const hexVal = cpu.toHex4(val);
            const disasm = cpu.disassemble(val);

            html += `
                <tr id="ram-row-${addr}" data-addr="${addr}">
                    <td class="mono">0x${cpu.toHex2(addr)}</td>
                    <td class="mono ram-hex">0x${hexVal}</td>
                    <td class="mono ram-dec">${val}</td>
                    <td class="mono ram-disasm">${escapeHtml(disasm)}</td>
                </tr>
            `;
        }
        tbodyRam.innerHTML = html;
        highlightRamPointers();
    }

    /**
     * Highlight RAM Pointers (PC, MAR, SP, ISR Vector)
     */
    function highlightRamPointers() {
        const rows = tbodyRam.querySelectorAll('tr');
        rows.forEach(r => r.classList.remove('highlight-pc', 'highlight-mar', 'highlight-sp', 'highlight-isr'));

        // Highlight ISR Vector (0x28)
        const isrRow = document.getElementById(`ram-row-${cpu.ISR_VECTOR}`);
        if (isrRow) isrRow.classList.add('highlight-isr');

        // Highlight SP
        const spRow = document.getElementById(`ram-row-${cpu.SP}`);
        if (spRow) spRow.classList.add('highlight-sp');

        // Highlight MAR
        const marRow = document.getElementById(`ram-row-${cpu.MAR}`);
        if (marRow) marRow.classList.add('highlight-mar');

        // Highlight PC
        const pcRow = document.getElementById(`ram-row-${cpu.PC}`);
        if (pcRow) pcRow.classList.add('highlight-pc');
    }

    /**
     * Scroll RAM Table to Address
     */
    function scrollToMemoryAddress(addr) {
        const row = document.getElementById(`ram-row-${addr}`);
        if (row && memScrollContainer) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('highlight-pc');
        }
    }

    /**
     * Update entire UI based on CPU Engine State
     */
    function updateUI() {
        // Header Status Badges
        document.getElementById('badge-phase').textContent = cpu.isHalted ? 'HALTED' : cpu.phase;
        document.getElementById('badge-tstate').textContent = cpu.microStepInfo.tStateName;
        document.getElementById('stat-cycles').textContent = cpu.clockCount;
        document.getElementById('stat-instructions').textContent = cpu.instructionCount;

        const intrBadge = document.getElementById('badge-intr');
        intrBadge.textContent = `IE: ${cpu.IE} | INTR: ${cpu.INTR}`;
        if (cpu.INTR === 1) {
            intrBadge.classList.add('active');
        } else {
            intrBadge.classList.remove('active');
        }

        // Registers Panel
        document.getElementById('reg-PC').textContent = `0x${cpu.toHex2(cpu.PC)}`;
        document.getElementById('reg-PC-dec').textContent = cpu.PC;

        document.getElementById('reg-MAR').textContent = `0x${cpu.toHex2(cpu.MAR)}`;
        document.getElementById('reg-MAR-dec').textContent = cpu.MAR;

        document.getElementById('reg-MDR').textContent = `0x${cpu.toHex4(cpu.MDR)}`;
        document.getElementById('reg-MDR-dec').textContent = cpu.MDR;

        document.getElementById('reg-IR').textContent = `0x${cpu.toHex4(cpu.IR)}`;
        document.getElementById('reg-IR-dec').textContent = cpu.currentMnemonic || 'NOP';

        document.getElementById('reg-ACC').textContent = `0x${cpu.toHex4(cpu.ACC)}`;
        document.getElementById('reg-ACC-dec').textContent = cpu.ACC;

        document.getElementById('reg-SP').textContent = `0x${cpu.toHex2(cpu.SP)}`;
        document.getElementById('reg-SP-dec').textContent = cpu.SP;

        // Flags Panel
        updateFlagIndicator('flag-z', 'val-flag-z', cpu.flags.Z);
        updateFlagIndicator('flag-n', 'val-flag-n', cpu.flags.N);
        updateFlagIndicator('flag-c', 'val-flag-c', cpu.flags.C);
        updateFlagIndicator('flag-ie', 'val-flag-ie', cpu.IE);

        // Hardware Output Digital Display
        document.getElementById('display-out-val').textContent = cpu.OUT;
        document.getElementById('display-out-hex').textContent = `0x${cpu.toHex4(cpu.OUT)}`;
        const binStr = cpu.toBin16(cpu.OUT);
        document.getElementById('display-out-bin').textContent = `${binStr.slice(0, 8)} ${binStr.slice(8)}`;

        // Micro-Operation Card
        document.getElementById('micro-tstate').textContent = cpu.microStepInfo.tStateName;
        document.getElementById('micro-phase').textContent = `${cpu.phase} PHASE`;
        document.getElementById('micro-rtl').textContent = cpu.microStepInfo.rtl;

        // Micro-Operation Control Signals
        const signalsContainer = document.getElementById('micro-signals');
        signalsContainer.innerHTML = '';
        cpu.microStepInfo.controlSignals.forEach(sig => {
            const tag = document.createElement('span');
            tag.className = 'signal-tag';
            tag.textContent = sig;
            signalsContainer.appendChild(tag);
        });

        // Timeline Strip
        const tSteps = document.querySelectorAll('.timeline-step');
        tSteps.forEach(step => {
            const tVal = step.getAttribute('data-t');
            if (tVal === cpu.microStepInfo.tStateName) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // Datapath SVG Update
        datapath.update(cpu);

        // Highlight Memory Pointers
        highlightRamPointers();

        // Sync trace logs
        syncTraceLogs();
    }

    /**
     * Update flag display badge
     */
    function updateFlagIndicator(badgeId, valId, state) {
        const badge = document.getElementById(badgeId);
        const valEl = document.getElementById(valId);
        valEl.textContent = state;
        if (state === 1) {
            badge.classList.add('active');
        } else {
            badge.classList.remove('active');
        }
    }

    /**
     * Append log entry to log stream
     */
    function addLogEntry(msg, type = 'system') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${msg}`;
        logStream.insertBefore(entry, logStream.firstChild);

        while (logStream.children.length > 50) {
            logStream.removeChild(logStream.lastChild);
        }
    }

    /**
     * Sync CPU Engine trace log to UI
     */
    let lastLogCount = 0;
    function syncTraceLogs() {
        if (cpu.traceLog.length > lastLogCount) {
            for (let i = cpu.traceLog.length - lastLogCount - 1; i >= 0; i--) {
                const item = cpu.traceLog[i];
                let type = 'system';
                if (item.text.includes('OUTPUT')) type = 'out';
                else if (item.text.includes('INTERRUPT') || item.text.includes('ISR')) type = 'intr';
                addLogEntry(item.text, type);
            }
            lastLogCount = cpu.traceLog.length;
        }
    }

    /**
     * Escape HTML helper
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Start application
    init();
});
