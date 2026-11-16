/**
 * Datapath Visualization Component
 * Renders the CPU architectural blocks, registers, and interactive glowing buses.
 * Directly corresponds to the hardware diagram in Image 3.
 */

class DatapathView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.blocks = {};
        this.buses = {};
        this.init();
    }

    init() {
        if (!this.container) return;

        // Create high-res responsive SVG
        this.container.innerHTML = `
        <svg viewBox="0 0 940 400" class="datapath-svg" id="cpu-datapath-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <!-- Marker for bus arrows -->
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" class="arrow-head" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="#38bdf8" class="arrow-active-head" />
                </marker>
                <marker id="arrow-data" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="#34d399" class="arrow-data-head" />
                </marker>
                <marker id="arrow-alu" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="#a78bfa" class="arrow-alu-head" />
                </marker>

                <!-- Glow filters -->
                <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <!-- BUS CONNECTING PATHS -->
            <g id="datapath-buses" class="bus-layer">
                <!-- PC to MAR (Address Bus) -->
                <path id="bus_pc_mar" class="bus-path" d="M 140 70 L 190 70" marker-end="url(#arrow)" />

                <!-- MAR to Memory -->
                <path id="bus_mar_mem" class="bus-path" d="M 290 70 L 340 70" marker-end="url(#arrow)" />

                <!-- Memory to MDR -->
                <path id="bus_mem_mdr" class="bus-path" d="M 450 70 L 500 70" marker-end="url(#arrow)" />

                <!-- MDR to Memory (Store) -->
                <path id="bus_mdr_mem" class="bus-path" d="M 500 85 L 450 85" marker-end="url(#arrow)" />

                <!-- MDR to IR -->
                <path id="bus_mdr_ir" class="bus-path" d="M 600 70 L 670 70" marker-end="url(#arrow)" />

                <!-- IR to Control Unit -->
                <path id="bus_ir_cu" class="bus-path" d="M 725 105 L 725 145" marker-end="url(#arrow)" />

                <!-- SP to MAR -->
                <path id="bus_sp_mar" class="bus-path" d="M 140 180 L 240 180 L 240 105" marker-end="url(#arrow)" />

                <!-- IR to MAR (Address Operand) -->
                <path id="bus_ir_mar" class="bus-path" d="M 670 85 L 630 85 L 630 25 L 240 25 L 240 40" marker-end="url(#arrow)" />

                <!-- IR to PC (Jump / Branch) -->
                <path id="bus_ir_pc" class="bus-path" d="M 670 60 L 640 60 L 640 15 L 90 15 L 90 40" marker-end="url(#arrow)" />

                <!-- MDR to ACC (Load) -->
                <path id="bus_mdr_acc" class="bus-path" d="M 550 105 L 550 250 L 250 250 L 250 280" marker-end="url(#arrow)" />

                <!-- ACC to MDR (Store) -->
                <path id="bus_acc_mdr" class="bus-path" d="M 270 280 L 270 235 L 570 235 L 570 105" marker-end="url(#arrow)" />

                <!-- ACC to ALU -->
                <path id="bus_acc_alu" class="bus-path" d="M 290 315 L 350 315" marker-end="url(#arrow)" />

                <!-- MDR to ALU -->
                <path id="bus_mdr_alu" class="bus-path" d="M 530 105 L 530 215 L 405 215 L 405 280" marker-end="url(#arrow)" />

                <!-- ALU to ACC (Result feedback) -->
                <path id="bus_alu_acc" class="bus-path" d="M 350 340 L 290 340" marker-end="url(#arrow)" />

                <!-- ALU to FLAGS -->
                <path id="bus_alu_flags" class="bus-path" d="M 460 315 L 510 315" marker-end="url(#arrow)" />

                <!-- ACC to OUTPUT -->
                <path id="bus_acc_out" class="bus-path" d="M 240 355 L 240 380 L 725 380 L 725 355" marker-end="url(#arrow)" />

                <!-- PC to MDR (Interrupt / Call PC push) -->
                <path id="bus_pc_mdr" class="bus-path" d="M 120 105 L 120 135 L 520 135 L 520 105" marker-end="url(#arrow)" />
            </g>

            <!-- ARCHITECTURAL REGISTER & FUNCTIONAL BLOCKS -->
            <g id="datapath-nodes">
                <!-- PC Block -->
                <g id="node-PC" class="dp-node" transform="translate(40, 40)">
                    <rect width="100" height="60" rx="8" class="node-box" />
                    <text x="50" y="26" class="node-title">PC</text>
                    <text x="50" y="48" class="node-val" id="dp-val-PC">00</text>
                </g>

                <!-- MAR Block -->
                <g id="node-MAR" class="dp-node" transform="translate(190, 40)">
                    <rect width="100" height="60" rx="8" class="node-box" />
                    <text x="50" y="26" class="node-title">MAR</text>
                    <text x="50" y="48" class="node-val" id="dp-val-MAR">00</text>
                </g>

                <!-- Memory Block -->
                <g id="node-Memory" class="dp-node" transform="translate(340, 40)">
                    <rect width="110" height="60" rx="8" class="node-box node-box-mem" />
                    <text x="55" y="26" class="node-title">Memory</text>
                    <text x="55" y="48" class="node-val" id="dp-val-MEM">M[00]</text>
                </g>

                <!-- MDR Block -->
                <g id="node-MDR" class="dp-node" transform="translate(500, 40)">
                    <rect width="100" height="60" rx="8" class="node-box" />
                    <text x="50" y="26" class="node-title">MDR</text>
                    <text x="50" y="48" class="node-val" id="dp-val-MDR">0000</text>
                </g>

                <!-- IR Block -->
                <g id="node-IR" class="dp-node" transform="translate(670, 40)">
                    <rect width="110" height="60" rx="8" class="node-box" />
                    <text x="55" y="26" class="node-title">IR</text>
                    <text x="55" y="48" class="node-val node-val-ir" id="dp-val-IR">NOP</text>
                </g>

                <!-- SP Block -->
                <g id="node-SP" class="dp-node" transform="translate(40, 150)">
                    <rect width="100" height="60" rx="8" class="node-box" />
                    <text x="50" y="26" class="node-title">SP</text>
                    <text x="50" y="48" class="node-val" id="dp-val-SP">7F</text>
                </g>

                <!-- Control Unit Block -->
                <g id="node-ControlUnit" class="dp-node" transform="translate(660, 145)">
                    <rect width="130" height="65" rx="8" class="node-box node-box-cu" />
                    <text x="65" y="28" class="node-title">Control Unit</text>
                    <text x="65" y="49" class="node-val node-val-cu" id="dp-val-CU">FETCH T0</text>
                </g>

                <!-- ACC Block -->
                <g id="node-ACC" class="dp-node" transform="translate(190, 285)">
                    <rect width="100" height="70" rx="8" class="node-box" />
                    <text x="50" y="28" class="node-title">ACC</text>
                    <text x="50" y="52" class="node-val" id="dp-val-ACC">0000</text>
                </g>

                <!-- ALU Block -->
                <g id="node-ALU" class="dp-node" transform="translate(350, 285)">
                    <polygon points="0,0 110,0 95,70 15,70" class="node-box node-box-alu" />
                    <text x="55" y="30" class="node-title">ALU</text>
                    <text x="55" y="52" class="node-val node-val-alu" id="dp-val-ALU">IDLE</text>
                </g>

                <!-- FLAGS Block -->
                <g id="node-FLAGS" class="dp-node" transform="translate(510, 285)">
                    <rect width="110" height="70" rx="8" class="node-box" />
                    <text x="55" y="28" class="node-title">FLAGS</text>
                    <text x="55" y="52" class="node-val node-val-flags" id="dp-val-FLAGS">Z0 N0 C0</text>
                </g>

                <!-- OUTPUT Block -->
                <g id="node-OUTPUT" class="dp-node" transform="translate(670, 285)">
                    <rect width="110" height="70" rx="8" class="node-box node-box-out" />
                    <text x="55" y="28" class="node-title">OUTPUT</text>
                    <text x="55" y="52" class="node-val node-val-out" id="dp-val-OUT">–</text>
                </g>
            </g>
        </svg>
        `;

        this.svg = document.getElementById('cpu-datapath-svg');
    }

    /**
     * Update visualization based on current CPU Engine state
     */
    update(cpu) {
        if (!this.svg) return;

        // Update Block Text Values
        document.getElementById('dp-val-PC').textContent = cpu.toHex2(cpu.PC);
        document.getElementById('dp-val-MAR').textContent = cpu.toHex2(cpu.MAR);
        document.getElementById('dp-val-MEM').textContent = `M[${cpu.toHex2(cpu.MAR)}]`;
        document.getElementById('dp-val-MDR').textContent = cpu.toHex4(cpu.MDR);
        document.getElementById('dp-val-IR').textContent = cpu.currentMnemonic || 'NOP';
        document.getElementById('dp-val-SP').textContent = cpu.toHex2(cpu.SP);
        document.getElementById('dp-val-ACC').textContent = cpu.toHex4(cpu.ACC);

        // Control Unit display
        const cuText = cpu.isHalted ? 'HALTED' : `${cpu.phase} ${cpu.microStepInfo.tStateName}`;
        document.getElementById('dp-val-CU').textContent = cuText;

        // Flags display
        document.getElementById('dp-val-FLAGS').textContent = `Z${cpu.flags.Z} N${cpu.flags.N} C${cpu.flags.C}`;

        // Output display
        document.getElementById('dp-val-OUT').textContent = cpu.OUT !== 0 ? `${cpu.OUT}` : '–';

        // ALU state display
        const aluEl = document.getElementById('dp-val-ALU');
        if (cpu.microStepInfo.activeComponents.includes('ALU')) {
            const sigs = cpu.microStepInfo.controlSignals.join(' ');
            if (sigs.includes('add')) aluEl.textContent = 'ADD (+)';
            else if (sigs.includes('sub')) aluEl.textContent = 'SUB (-)';
            else if (sigs.includes('mul')) aluEl.textContent = 'MUL (×)';
            else if (sigs.includes('inc')) aluEl.textContent = 'INC (+1)';
            else if (sigs.includes('dec')) aluEl.textContent = 'DEC (-1)';
            else if (sigs.includes('and')) aluEl.textContent = 'AND (&)';
            else if (sigs.includes('or')) aluEl.textContent = 'OR (|)';
            else if (sigs.includes('shl')) aluEl.textContent = 'SHL (<<)';
            else if (sigs.includes('shr')) aluEl.textContent = 'SHR (>>)';
            else aluEl.textContent = 'ACTIVE';
        } else {
            aluEl.textContent = 'IDLE';
        }

        // Reset all node highlights
        const allNodes = this.svg.querySelectorAll('.dp-node');
        allNodes.forEach(node => {
            node.classList.remove('active-node', 'active-node-alu', 'active-node-cu');
        });

        // Highlight active components
        cpu.microStepInfo.activeComponents.forEach(compName => {
            const node = document.getElementById(`node-${compName}`);
            if (node) {
                if (compName === 'ALU') {
                    node.classList.add('active-node-alu');
                } else if (compName === 'ControlUnit') {
                    node.classList.add('active-node-cu');
                } else {
                    node.classList.add('active-node');
                }
            }
        });

        // Reset all bus highlights
        const allBuses = this.svg.querySelectorAll('.bus-path');
        allBuses.forEach(bus => {
            bus.classList.remove('bus-active', 'bus-active-data', 'bus-active-alu');
            bus.setAttribute('marker-end', 'url(#arrow)');
        });

        // Highlight active buses
        cpu.microStepInfo.activeBuses.forEach(busId => {
            const bus = document.getElementById(busId);
            if (bus) {
                if (busId.includes('alu')) {
                    bus.classList.add('bus-active-alu');
                    bus.setAttribute('marker-end', 'url(#arrow-alu)');
                } else if (busId.includes('mdr') || busId.includes('acc') || busId.includes('mem')) {
                    bus.classList.add('bus-active-data');
                    bus.setAttribute('marker-end', 'url(#arrow-data)');
                } else {
                    bus.classList.add('bus-active');
                    bus.setAttribute('marker-end', 'url(#arrow-active)');
                }
            }
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DatapathView };
} else {
    window.DatapathView = DatapathView;
}
