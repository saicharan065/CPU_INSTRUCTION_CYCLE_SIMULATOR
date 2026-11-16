/**
 * CPU Instruction Cycle & Datapath Simulator Engine
 * Architecture: 16-bit Word (8-bit Opcode, 8-bit Operand/Address)
 * Supports Fetch, Decode, Execute, Interrupt Cycle, and Micro-operations (T-States)
 */

class CPUEngine {
    constructor() {
        // Memory: 256 words (16-bit: 0x0000 - 0xFFFF)
        this.memorySize = 256;
        this.memory = new Uint16Array(this.memorySize);

        // Core Registers
        this.PC = 0x00;       // Program Counter (8-bit)
        this.MAR = 0x00;      // Memory Address Register (8-bit)
        this.MDR = 0x0000;    // Memory Data Register (16-bit)
        this.IR = 0x0000;     // Instruction Register (16-bit)
        this.ACC = 0x0000;    // Accumulator (16-bit signed/unsigned)
        this.SP = 0x7F;       // Stack Pointer (default 0x7F = 127)
        this.OUT = 0x0000;    // Output Register

        // Flags: Zero (Z), Negative (N), Carry (C), Overflow (V)
        this.flags = {
            Z: 0,
            N: 0,
            C: 0,
            V: 0
        };

        // Interrupt subsystem
        this.IE = 0;          // Interrupt Enable flip-flop
        this.INTR = 0;        // Hardware Interrupt line
        this.INTA = 0;        // Interrupt Acknowledge
        this.ISR_VECTOR = 0x28; // Vector address for ISR (from theoretical ref)

        // Execution State & T-States
        this.phase = 'FETCH'; // FETCH, DECODE, EXECUTE, INTERRUPT, HALTED
        this.tState = 0;      // 0, 1, 2, 3, 4, 5, 6...
        this.isHalted = false;
        this.clockCount = 0;
        this.instructionCount = 0;

        // Decoded instruction components
        this.currentOpcode = 0x00;
        this.currentOperand = 0x00;
        this.currentMnemonic = 'NOP';

        // History / Trace log
        this.traceLog = [];
        this.maxLogLength = 100;

        // Current micro-step description & active elements for datapath highlight
        this.microStepInfo = {
            tStateName: 'T0',
            phase: 'FETCH',
            rtl: 'Ready to fetch',
            controlSignals: [],
            activeComponents: [],
            activeBuses: []
        };

        // Instruction Definitions (Matching reference images)
        this.ISA = {
            0x00: { mnemonic: 'NOP', name: 'No Operation', cycles: 4, desc: 'No operation performed' },
            0x01: { mnemonic: 'LDA', name: 'Load Accumulator', cycles: 7, hasOperand: true, desc: 'AC ← RAM[addr]' },
            0x02: { mnemonic: 'STA', name: 'Store Accumulator', cycles: 6, hasOperand: true, desc: 'RAM[addr] ← AC' },
            0x03: { mnemonic: 'ADD', name: 'Add to Accumulator', cycles: 7, hasOperand: true, desc: 'AC ← AC + RAM[addr], Flags' },
            0x04: { mnemonic: 'SUB', name: 'Subtract from Accumulator', cycles: 7, hasOperand: true, desc: 'AC ← AC - RAM[addr], Flags' },
            0x05: { mnemonic: 'MUL', name: 'Multiply with Accumulator', cycles: 8, hasOperand: true, desc: 'AC ← AC * RAM[addr], Flags' },
            0x06: { mnemonic: 'AND', name: 'Bitwise AND', cycles: 7, hasOperand: true, desc: 'AC ← AC & RAM[addr], Flags' },
            0x07: { mnemonic: 'OR',  name: 'Bitwise OR', cycles: 7, hasOperand: true, desc: 'AC ← AC | RAM[addr], Flags' },
            0x08: { mnemonic: 'XOR', name: 'Bitwise XOR', cycles: 7, hasOperand: true, desc: 'AC ← AC ^ RAM[addr], Flags' },
            0x09: { mnemonic: 'NOT', name: 'Bitwise NOT', cycles: 5, hasOperand: false, desc: 'AC ← ~AC, Flags' },
            0x0A: { mnemonic: 'SHL', name: 'Shift Left', cycles: 5, hasOperand: false, desc: 'AC ← AC << 1, Flags' },
            0x0B: { mnemonic: 'INC', name: 'Increment Accumulator', cycles: 5, hasOperand: false, desc: 'AC ← AC + 1, Flags' },
            0x0C: { mnemonic: 'DEC', name: 'Decrement Accumulator', cycles: 5, hasOperand: false, desc: 'AC ← AC - 1, Flags' },
            0x0D: { mnemonic: 'JMP', name: 'Unconditional Jump', cycles: 5, hasOperand: true, desc: 'PC ← addr' },
            0x0E: { mnemonic: 'JZ',  name: 'Jump if Zero', cycles: 5, hasOperand: true, desc: 'If Z == 1, PC ← addr' },
            0x0F: { mnemonic: 'JNZ', name: 'Jump if Not Zero', cycles: 5, hasOperand: true, desc: 'If Z == 0, PC ← addr' },
            0x10: { mnemonic: 'LDI', name: 'Load Immediate', cycles: 5, hasOperand: true, desc: 'AC ← imm' },
            0x11: { mnemonic: 'OUT', name: 'Output Accumulator', cycles: 5, hasOperand: false, desc: 'OUT_REG ← AC' },
            0x12: { mnemonic: 'IN',  name: 'Input to Accumulator', cycles: 5, hasOperand: false, desc: 'AC ← IN_REG' },
            0x13: { mnemonic: 'EI',  name: 'Enable Interrupts', cycles: 5, hasOperand: false, desc: 'IE ← 1' },
            0x14: { mnemonic: 'DI',  name: 'Disable Interrupts', cycles: 5, hasOperand: false, desc: 'IE ← 0' },
            0x15: { mnemonic: 'IRET',name: 'Return from Interrupt', cycles: 7, hasOperand: false, desc: 'AC ← Pop(), PC ← Pop(), IE ← 1' },
            0x16: { mnemonic: 'CALL',name: 'Call Subroutine', cycles: 7, hasOperand: true, desc: 'Push(PC), PC ← addr' },
            0x17: { mnemonic: 'RET', name: 'Return Subroutine', cycles: 6, hasOperand: false, desc: 'PC ← Pop()' },
            0x18: { mnemonic: 'PUSH',name: 'Push Accumulator', cycles: 6, hasOperand: false, desc: 'Push(AC)' },
            0x19: { mnemonic: 'POP', name: 'Pop to Accumulator', cycles: 6, hasOperand: false, desc: 'AC ← Pop()' },
            0x1E: { mnemonic: 'SHR', name: 'Shift Right', cycles: 5, hasOperand: false, desc: 'AC ← AC >> 1, Flags' },
            0x3F: { mnemonic: 'HLT', name: 'Halt Processor', cycles: 5, hasOperand: false, desc: 'Halt clock generator' }
        };

        // Opcode reverse lookup by mnemonic
        this.mnemonicToOpcode = {};
        for (const [opStr, info] of Object.entries(this.ISA)) {
            this.mnemonicToOpcode[info.mnemonic] = parseInt(opStr, 10);
        }
    }

    /**
     * Resets registers, flags, clock and state
     */
    reset(clearMemory = false) {
        if (clearMemory) {
            this.memory.fill(0);
        }
        this.PC = 0x00;
        this.MAR = 0x00;
        this.MDR = 0x0000;
        this.IR = 0x0000;
        this.ACC = 0x0000;
        this.SP = 0x7F;
        this.OUT = 0x0000;
        this.flags = { Z: 0, N: 0, C: 0, V: 0 };
        this.IE = 0;
        this.INTR = 0;
        this.INTA = 0;
        this.phase = 'FETCH';
        this.tState = 0;
        this.isHalted = false;
        this.clockCount = 0;
        this.instructionCount = 0;
        this.currentOpcode = 0x00;
        this.currentOperand = 0x00;
        this.currentMnemonic = 'NOP';
        this.traceLog = [];
        this.microStepInfo = {
            tStateName: 'T0',
            phase: 'FETCH',
            rtl: 'CPU Reset. Ready for T0 fetch.',
            controlSignals: ['RST'],
            activeComponents: ['PC'],
            activeBuses: []
        };
    }

    /**
     * Trigger asynchronous hardware interrupt
     */
    triggerInterrupt() {
        this.INTR = 1;
        this.logMessage(`[INTR] Hardware interrupt line asserted high! (IE = ${this.IE})`);
    }

    /**
     * Update flags based on 16-bit ACC value
     */
    updateFlags(val, carry = null) {
        val = val & 0xFFFF;
        this.flags.Z = (val === 0) ? 1 : 0;
        this.flags.N = ((val & 0x8000) !== 0) ? 1 : 0;
        if (carry !== null) {
            this.flags.C = carry ? 1 : 0;
        }
    }

    /**
     * Execute one micro-operation (T-State)
     * Returns true if successfully stepped, false if halted
     */
    stepMicro() {
        if (this.isHalted) {
            return false;
        }

        this.clockCount++;

        // Handle phases
        if (this.phase === 'FETCH') {
            this.stepFetchPhase();
        } else if (this.phase === 'DECODE') {
            this.stepDecodePhase();
        } else if (this.phase === 'EXECUTE') {
            this.stepExecutePhase();
        } else if (this.phase === 'INTERRUPT') {
            this.stepInterruptPhase();
        }

        return true;
    }

    /**
     * FETCH Phase: T0, T1, T2
     */
    stepFetchPhase() {
        if (this.tState === 0) {
            // T0: Address from PC to MAR via Address Bus
            this.MAR = this.PC & 0xFF;
            this.microStepInfo = {
                tStateName: 'T0',
                phase: 'FETCH',
                rtl: `MAR ← PC [0x${this.toHex2(this.PC)}]`,
                controlSignals: ['PC_out', 'MAR_in'],
                activeComponents: ['PC', 'MAR'],
                activeBuses: ['bus_pc_mar']
            };
            this.tState = 1;
        } else if (this.tState === 1) {
            // T1: Memory Read into MDR across Data Bus; PC incremented (PC ← PC + 1)
            this.MDR = this.memory[this.MAR];
            const oldPC = this.PC;
            this.PC = (this.PC + 1) & 0xFF;

            this.microStepInfo = {
                tStateName: 'T1',
                phase: 'FETCH',
                rtl: `MDR ← RAM[MAR] [0x${this.toHex4(this.MDR)}], PC ← PC + 1 [0x${this.toHex2(this.PC)}]`,
                controlSignals: ['MEM_read', 'MDR_in', 'PC_inc'],
                activeComponents: ['Memory', 'MDR', 'PC'],
                activeBuses: ['bus_mar_mem', 'bus_mem_mdr']
            };
            this.tState = 2;
        } else if (this.tState === 2) {
            // T2: Instruction loaded into IR
            this.IR = this.MDR;
            this.currentOpcode = (this.IR >> 8) & 0xFF;
            this.currentOperand = this.IR & 0xFF;
            const def = this.ISA[this.currentOpcode];
            this.currentMnemonic = def ? def.mnemonic : `UNK(0x${this.toHex2(this.currentOpcode)})`;

            this.microStepInfo = {
                tStateName: 'T2',
                phase: 'FETCH',
                rtl: `IR ← MDR [0x${this.toHex4(this.IR)}: ${this.currentMnemonic} 0x${this.toHex2(this.currentOperand)}]`,
                controlSignals: ['MDR_out', 'IR_in'],
                activeComponents: ['MDR', 'IR'],
                activeBuses: ['bus_mdr_ir']
            };
            this.phase = 'DECODE';
            this.tState = 3;
        }
    }

    /**
     * DECODE Phase: T3
     */
    stepDecodePhase() {
        // T3: Control Unit extracts opcode, resolves addressing mode, prepares control matrix
        const def = this.ISA[this.currentOpcode];
        const mnemonic = def ? def.mnemonic : 'UNKNOWN';

        this.microStepInfo = {
            tStateName: 'T3',
            phase: 'DECODE',
            rtl: `Control Unit decodes Opcode 0x${this.toHex2(this.currentOpcode)} (${mnemonic}), Operand = 0x${this.toHex2(this.currentOperand)}`,
            controlSignals: ['CU_decode'],
            activeComponents: ['IR', 'ControlUnit'],
            activeBuses: ['bus_ir_cu']
        };

        this.phase = 'EXECUTE';
        this.tState = 4;
    }

    /**
     * EXECUTE Phase: T4, T5, T6, etc.
     */
    stepExecutePhase() {
        const opcode = this.currentOpcode;
        const operand = this.currentOperand;

        switch (opcode) {
            // NOP (0x00)
            case 0x00:
                this.microStepInfo = {
                    tStateName: `T${this.tState}`,
                    phase: 'EXECUTE',
                    rtl: 'NOP: No Operation executed',
                    controlSignals: ['NOP'],
                    activeComponents: ['ControlUnit'],
                    activeBuses: []
                };
                this.finishInstruction();
                break;

            // LDA addr (0x01): AC ← RAM[addr]
            case 0x01:
                if (this.tState === 4) {
                    this.MAR = operand;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← IR[addr] [0x${this.toHex2(operand)}]`,
                        controlSignals: ['IR_addr_out', 'MAR_in'],
                        activeComponents: ['IR', 'MAR'],
                        activeBuses: ['bus_ir_mar']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.MDR = this.memory[this.MAR];
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `MDR ← RAM[MAR] [0x${this.toHex4(this.MDR)}]`,
                        controlSignals: ['MEM_read', 'MDR_in'],
                        activeComponents: ['Memory', 'MDR'],
                        activeBuses: ['bus_mar_mem', 'bus_mem_mdr']
                    };
                    this.tState = 6;
                } else if (this.tState === 6) {
                    this.ACC = this.MDR;
                    this.updateFlags(this.ACC);
                    this.microStepInfo = {
                        tStateName: 'T6',
                        phase: 'EXECUTE',
                        rtl: `ACC ← MDR [0x${this.toHex4(this.ACC)}] (${this.ACC}), Flags [Z=${this.flags.Z}, N=${this.flags.N}]`,
                        controlSignals: ['MDR_out', 'ACC_in', 'Flags_set'],
                        activeComponents: ['MDR', 'ACC', 'FLAGS'],
                        activeBuses: ['bus_mdr_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // STA addr (0x02): RAM[addr] ← AC
            case 0x02:
                if (this.tState === 4) {
                    this.MAR = operand;
                    this.MDR = this.ACC;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← IR[addr] [0x${this.toHex2(operand)}], MDR ← ACC [0x${this.toHex4(this.ACC)}]`,
                        controlSignals: ['IR_addr_out', 'MAR_in', 'ACC_out', 'MDR_in'],
                        activeComponents: ['IR', 'MAR', 'ACC', 'MDR'],
                        activeBuses: ['bus_ir_mar', 'bus_acc_mdr']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.memory[this.MAR] = this.MDR;
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `RAM[MAR] ← MDR [RAM[0x${this.toHex2(this.MAR)}] = 0x${this.toHex4(this.MDR)}]`,
                        controlSignals: ['MDR_out', 'MEM_write'],
                        activeComponents: ['MDR', 'Memory'],
                        activeBuses: ['bus_mdr_mem']
                    };
                    this.finishInstruction();
                }
                break;

            // ADD addr (0x03): AC ← AC + RAM[addr], Flags
            case 0x03:
                if (this.tState === 4) {
                    this.MAR = operand;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← IR[addr] [0x${this.toHex2(operand)}]`,
                        controlSignals: ['IR_addr_out', 'MAR_in'],
                        activeComponents: ['IR', 'MAR'],
                        activeBuses: ['bus_ir_mar']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.MDR = this.memory[this.MAR];
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `MDR ← RAM[MAR] [0x${this.toHex4(this.MDR)}] (${this.MDR})`,
                        controlSignals: ['MEM_read', 'MDR_in'],
                        activeComponents: ['Memory', 'MDR'],
                        activeBuses: ['bus_mar_mem', 'bus_mem_mdr']
                    };
                    this.tState = 6;
                } else if (this.tState === 6) {
                    const sum = this.ACC + this.MDR;
                    const carry = sum > 0xFFFF;
                    this.ACC = sum & 0xFFFF;
                    this.updateFlags(this.ACC, carry);
                    this.microStepInfo = {
                        tStateName: 'T6',
                        phase: 'EXECUTE',
                        rtl: `ACC ← ACC + MDR [${this.ACC}], Flags Updated [Z=${this.flags.Z}, N=${this.flags.N}, C=${this.flags.C}]`,
                        controlSignals: ['ALU_add', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ACC', 'MDR', 'ALU', 'FLAGS'],
                        activeBuses: ['bus_acc_alu', 'bus_mdr_alu', 'bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // SUB addr (0x04): AC ← AC - RAM[addr], Flags
            case 0x04:
                if (this.tState === 4) {
                    this.MAR = operand;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← IR[addr] [0x${this.toHex2(operand)}]`,
                        controlSignals: ['IR_addr_out', 'MAR_in'],
                        activeComponents: ['IR', 'MAR'],
                        activeBuses: ['bus_ir_mar']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.MDR = this.memory[this.MAR];
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `MDR ← RAM[MAR] [0x${this.toHex4(this.MDR)}] (${this.MDR})`,
                        controlSignals: ['MEM_read', 'MDR_in'],
                        activeComponents: ['Memory', 'MDR'],
                        activeBuses: ['bus_mar_mem', 'bus_mem_mdr']
                    };
                    this.tState = 6;
                } else if (this.tState === 6) {
                    const diff = this.ACC - this.MDR;
                    const carry = diff < 0; // borrow
                    this.ACC = diff & 0xFFFF;
                    this.updateFlags(this.ACC, carry);
                    this.microStepInfo = {
                        tStateName: 'T6',
                        phase: 'EXECUTE',
                        rtl: `ACC ← AC - MDR [${this.ACC}], Flags Updated [Z=${this.flags.Z}, N=${this.flags.N}, C=${this.flags.C}]`,
                        controlSignals: ['ALU_sub', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ACC', 'MDR', 'ALU', 'FLAGS'],
                        activeBuses: ['bus_acc_alu', 'bus_mdr_alu', 'bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // MUL addr (0x05): AC ← AC * RAM[addr]
            case 0x05:
                if (this.tState === 4) {
                    this.MAR = operand;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← IR[addr] [0x${this.toHex2(operand)}]`,
                        controlSignals: ['IR_addr_out', 'MAR_in'],
                        activeComponents: ['IR', 'MAR'],
                        activeBuses: ['bus_ir_mar']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.MDR = this.memory[this.MAR];
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `MDR ← RAM[MAR] [0x${this.toHex4(this.MDR)}] (${this.MDR})`,
                        controlSignals: ['MEM_read', 'MDR_in'],
                        activeComponents: ['Memory', 'MDR'],
                        activeBuses: ['bus_mar_mem', 'bus_mem_mdr']
                    };
                    this.tState = 6;
                } else if (this.tState === 6) {
                    this.microStepInfo = {
                        tStateName: 'T6',
                        phase: 'EXECUTE',
                        rtl: `ALU Multiplier: ${this.ACC} × ${this.MDR}`,
                        controlSignals: ['ALU_mul_start'],
                        activeComponents: ['ALU', 'ACC', 'MDR'],
                        activeBuses: ['bus_acc_alu', 'bus_mdr_alu']
                    };
                    this.tState = 7;
                } else if (this.tState === 7) {
                    const prod = this.ACC * this.MDR;
                    const carry = prod > 0xFFFF;
                    this.ACC = prod & 0xFFFF;
                    this.updateFlags(this.ACC, carry);
                    this.microStepInfo = {
                        tStateName: 'T7',
                        phase: 'EXECUTE',
                        rtl: `ACC ← ALU Product [${this.ACC}], Flags Updated [Z=${this.flags.Z}, N=${this.flags.N}]`,
                        controlSignals: ['ALU_out', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ALU', 'ACC', 'FLAGS'],
                        activeBuses: ['bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // LDI imm (0x10): AC ← imm
            case 0x10:
                if (this.tState === 4) {
                    this.ACC = operand;
                    this.updateFlags(this.ACC);
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `ACC ← IR[imm] [0x${this.toHex4(this.ACC)}] (${this.ACC})`,
                        controlSignals: ['IR_imm_out', 'ACC_in'],
                        activeComponents: ['IR', 'ACC'],
                        activeBuses: ['bus_ir_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // INC (0x0B): AC ← AC + 1, Flags
            case 0x0B:
                if (this.tState === 4) {
                    const sum = this.ACC + 1;
                    const carry = sum > 0xFFFF;
                    this.ACC = sum & 0xFFFF;
                    this.updateFlags(this.ACC, carry);
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `ACC ← ACC + 1 [${this.ACC}], Flags [Z=${this.flags.Z}, N=${this.flags.N}]`,
                        controlSignals: ['ALU_inc', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ALU', 'ACC', 'FLAGS'],
                        activeBuses: ['bus_acc_alu', 'bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // DEC (0x0C): AC ← AC - 1, Flags
            case 0x0C:
                if (this.tState === 4) {
                    const diff = this.ACC - 1;
                    const carry = diff < 0;
                    this.ACC = diff & 0xFFFF;
                    this.updateFlags(this.ACC, carry);
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `ACC ← ACC - 1 [${this.ACC}], Flags [Z=${this.flags.Z}, N=${this.flags.N}]`,
                        controlSignals: ['ALU_dec', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ALU', 'ACC', 'FLAGS'],
                        activeBuses: ['bus_acc_alu', 'bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // JMP addr (0x0D): PC ← addr
            case 0x0D:
                if (this.tState === 4) {
                    this.PC = operand;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `PC ← IR[addr] [0x${this.toHex2(this.PC)}] (Jump to target)`,
                        controlSignals: ['IR_addr_out', 'PC_load'],
                        activeComponents: ['IR', 'PC'],
                        activeBuses: ['bus_ir_pc']
                    };
                    this.finishInstruction();
                }
                break;

            // JZ addr (0x0E): If Z == 1, PC ← addr
            case 0x0E:
                if (this.tState === 4) {
                    const taken = this.flags.Z === 1;
                    if (taken) {
                        this.PC = operand;
                    }
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: taken ? `Condition Z==1 met: PC ← 0x${this.toHex2(this.PC)}` : `Condition Z==1 NOT met (Z=0): Continue to next instruction`,
                        controlSignals: taken ? ['Branch_taken', 'PC_load'] : ['Branch_not_taken'],
                        activeComponents: taken ? ['FLAGS', 'IR', 'PC'] : ['FLAGS', 'ControlUnit'],
                        activeBuses: taken ? ['bus_ir_pc'] : []
                    };
                    this.finishInstruction();
                }
                break;

            // JNZ addr (0x0F): If Z == 0, PC ← addr
            case 0x0F:
                if (this.tState === 4) {
                    const taken = this.flags.Z === 0;
                    if (taken) {
                        this.PC = operand;
                    }
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: taken ? `Condition Z==0 met: PC ← 0x${this.toHex2(this.PC)}` : `Condition Z==0 NOT met (Z=1): Continue to next instruction`,
                        controlSignals: taken ? ['Branch_taken', 'PC_load'] : ['Branch_not_taken'],
                        activeComponents: taken ? ['FLAGS', 'IR', 'PC'] : ['FLAGS', 'ControlUnit'],
                        activeBuses: taken ? ['bus_ir_pc'] : []
                    };
                    this.finishInstruction();
                }
                break;

            // OUT (0x11): OUT_REG ← AC
            case 0x11:
                if (this.tState === 4) {
                    this.OUT = this.ACC;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `OUT_REG ← ACC [${this.OUT}] (0x${this.toHex4(this.OUT)})`,
                        controlSignals: ['ACC_out', 'OUT_in'],
                        activeComponents: ['ACC', 'OUTPUT'],
                        activeBuses: ['bus_acc_out']
                    };
                    this.logMessage(`[DISPLAY OUTPUT] Value: ${this.OUT} (Hex: 0x${this.toHex4(this.OUT)})`);
                    this.finishInstruction();
                }
                break;

            // IN (0x12): AC ← IN_REG (default immediate/simulation)
            case 0x12:
                if (this.tState === 4) {
                    this.ACC = operand;
                    this.updateFlags(this.ACC);
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `ACC ← IN_REG [${this.ACC}]`,
                        controlSignals: ['IN_out', 'ACC_in'],
                        activeComponents: ['ACC'],
                        activeBuses: []
                    };
                    this.finishInstruction();
                }
                break;

            // EI (0x13): IE ← 1
            case 0x13:
                if (this.tState === 4) {
                    this.IE = 1;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: 'IE ← 1 (Interrupts Globally Enabled)',
                        controlSignals: ['IE_set'],
                        activeComponents: ['ControlUnit'],
                        activeBuses: []
                    };
                    this.finishInstruction();
                }
                break;

            // DI (0x14): IE ← 0
            case 0x14:
                if (this.tState === 4) {
                    this.IE = 0;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: 'IE ← 0 (Interrupts Globally Disabled)',
                        controlSignals: ['IE_clear'],
                        activeComponents: ['ControlUnit'],
                        activeBuses: []
                    };
                    this.finishInstruction();
                }
                break;

            // IRET (0x15): AC ← Pop(), PC ← Pop(), IE ← 1
            case 0x15:
                if (this.tState === 4) {
                    // Pop AC
                    this.MAR = this.SP;
                    this.SP = (this.SP + 1) & 0xFF;
                    this.ACC = this.memory[this.MAR];
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `Restore AC: MAR ← SP [0x${this.toHex2(this.MAR)}], SP ← SP+1 [0x${this.toHex2(this.SP)}], ACC ← RAM[MAR] [0x${this.toHex4(this.ACC)}]`,
                        controlSignals: ['SP_out', 'MAR_in', 'SP_inc', 'MEM_read', 'ACC_in'],
                        activeComponents: ['SP', 'MAR', 'Memory', 'ACC'],
                        activeBuses: ['bus_sp_mar', 'bus_mem_mdr', 'bus_mdr_acc']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    // Pop PC
                    this.MAR = this.SP;
                    this.SP = (this.SP + 1) & 0xFF;
                    this.PC = this.memory[this.MAR] & 0xFF;
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `Restore PC: MAR ← SP [0x${this.toHex2(this.MAR)}], SP ← SP+1 [0x${this.toHex2(this.SP)}], PC ← RAM[MAR] [0x${this.toHex2(this.PC)}]`,
                        controlSignals: ['SP_out', 'MAR_in', 'SP_inc', 'MEM_read', 'PC_in'],
                        activeComponents: ['SP', 'MAR', 'Memory', 'PC'],
                        activeBuses: ['bus_sp_mar', 'bus_mem_mdr', 'bus_mdr_pc']
                    };
                    this.tState = 6;
                } else if (this.tState === 6) {
                    this.IE = 1; // Re-enable interrupts
                    this.microStepInfo = {
                        tStateName: 'T6',
                        phase: 'EXECUTE',
                        rtl: 'Re-enable Interrupts: IE ← 1. ISR Completed, returning to main program.',
                        controlSignals: ['IE_set'],
                        activeComponents: ['ControlUnit'],
                        activeBuses: []
                    };
                    this.finishInstruction();
                }
                break;

            // CALL addr (0x16): Push(PC), PC ← addr
            case 0x16:
                if (this.tState === 4) {
                    this.SP = (this.SP - 1) & 0xFF;
                    this.MAR = this.SP;
                    this.MDR = this.PC;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `SP ← SP - 1 [0x${this.toHex2(this.SP)}], MAR ← SP, MDR ← PC [0x${this.toHex2(this.PC)}]`,
                        controlSignals: ['SP_dec', 'MAR_in', 'PC_out', 'MDR_in'],
                        activeComponents: ['SP', 'MAR', 'PC', 'MDR'],
                        activeBuses: ['bus_sp_mar', 'bus_pc_mdr']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.memory[this.MAR] = this.MDR;
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `RAM[MAR] ← MDR [Pushed return PC to stack]`,
                        controlSignals: ['MEM_write'],
                        activeComponents: ['Memory', 'MDR'],
                        activeBuses: ['bus_mdr_mem']
                    };
                    this.tState = 6;
                } else if (this.tState === 6) {
                    this.PC = operand;
                    this.microStepInfo = {
                        tStateName: 'T6',
                        phase: 'EXECUTE',
                        rtl: `PC ← IR[addr] [0x${this.toHex2(this.PC)}] (Subroutine branch)`,
                        controlSignals: ['IR_addr_out', 'PC_load'],
                        activeComponents: ['IR', 'PC'],
                        activeBuses: ['bus_ir_pc']
                    };
                    this.finishInstruction();
                }
                break;

            // RET (0x17): PC ← Pop()
            case 0x17:
                if (this.tState === 4) {
                    this.MAR = this.SP;
                    this.SP = (this.SP + 1) & 0xFF;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← SP [0x${this.toHex2(this.MAR)}], SP ← SP + 1 [0x${this.toHex2(this.SP)}]`,
                        controlSignals: ['SP_out', 'MAR_in', 'SP_inc'],
                        activeComponents: ['SP', 'MAR'],
                        activeBuses: ['bus_sp_mar']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.MDR = this.memory[this.MAR];
                    this.PC = this.MDR & 0xFF;
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `MDR ← RAM[MAR], PC ← MDR [0x${this.toHex2(this.PC)}] (Subroutine return)`,
                        controlSignals: ['MEM_read', 'MDR_in', 'MDR_out', 'PC_load'],
                        activeComponents: ['Memory', 'MDR', 'PC'],
                        activeBuses: ['bus_mem_mdr', 'bus_mdr_pc']
                    };
                    this.finishInstruction();
                }
                break;

            // PUSH (0x18): SP ← SP - 1, RAM[SP] ← AC
            case 0x18:
                if (this.tState === 4) {
                    this.SP = (this.SP - 1) & 0xFF;
                    this.MAR = this.SP;
                    this.MDR = this.ACC;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `SP ← SP - 1 [0x${this.toHex2(this.SP)}], MAR ← SP, MDR ← ACC [0x${this.toHex4(this.ACC)}]`,
                        controlSignals: ['SP_dec', 'MAR_in', 'ACC_out', 'MDR_in'],
                        activeComponents: ['SP', 'MAR', 'ACC', 'MDR'],
                        activeBuses: ['bus_sp_mar', 'bus_acc_mdr']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.memory[this.MAR] = this.MDR;
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `RAM[MAR] ← MDR [Pushed ACC to stack]`,
                        controlSignals: ['MEM_write'],
                        activeComponents: ['Memory', 'MDR'],
                        activeBuses: ['bus_mdr_mem']
                    };
                    this.finishInstruction();
                }
                break;

            // POP (0x19): AC ← RAM[SP], SP ← SP + 1
            case 0x19:
                if (this.tState === 4) {
                    this.MAR = this.SP;
                    this.SP = (this.SP + 1) & 0xFF;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← SP [0x${this.toHex2(this.MAR)}], SP ← SP + 1 [0x${this.toHex2(this.SP)}]`,
                        controlSignals: ['SP_out', 'MAR_in', 'SP_inc'],
                        activeComponents: ['SP', 'MAR'],
                        activeBuses: ['bus_sp_mar']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.MDR = this.memory[this.MAR];
                    this.ACC = this.MDR;
                    this.updateFlags(this.ACC);
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `MDR ← RAM[MAR], ACC ← MDR [0x${this.toHex4(this.ACC)}]`,
                        controlSignals: ['MEM_read', 'MDR_in', 'MDR_out', 'ACC_in'],
                        activeComponents: ['Memory', 'MDR', 'ACC'],
                        activeBuses: ['bus_mem_mdr', 'bus_mdr_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // AND addr (0x06): AC ← AC & RAM[addr]
            case 0x06:
                if (this.tState === 4) {
                    this.MAR = operand;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← IR[addr] [0x${this.toHex2(operand)}]`,
                        controlSignals: ['IR_addr_out', 'MAR_in'],
                        activeComponents: ['IR', 'MAR'],
                        activeBuses: ['bus_ir_mar']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.MDR = this.memory[this.MAR];
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `MDR ← RAM[MAR] [0x${this.toHex4(this.MDR)}]`,
                        controlSignals: ['MEM_read', 'MDR_in'],
                        activeComponents: ['Memory', 'MDR'],
                        activeBuses: ['bus_mar_mem', 'bus_mem_mdr']
                    };
                    this.tState = 6;
                } else if (this.tState === 6) {
                    this.ACC = (this.ACC & this.MDR) & 0xFFFF;
                    this.updateFlags(this.ACC);
                    this.microStepInfo = {
                        tStateName: 'T6',
                        phase: 'EXECUTE',
                        rtl: `ACC ← ACC & MDR [0x${this.toHex4(this.ACC)}], Flags [Z=${this.flags.Z}, N=${this.flags.N}]`,
                        controlSignals: ['ALU_and', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ALU', 'ACC', 'FLAGS', 'MDR'],
                        activeBuses: ['bus_acc_alu', 'bus_mdr_alu', 'bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // OR addr (0x07): AC ← AC | RAM[addr]
            case 0x07:
                if (this.tState === 4) {
                    this.MAR = operand;
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `MAR ← IR[addr] [0x${this.toHex2(operand)}]`,
                        controlSignals: ['IR_addr_out', 'MAR_in'],
                        activeComponents: ['IR', 'MAR'],
                        activeBuses: ['bus_ir_mar']
                    };
                    this.tState = 5;
                } else if (this.tState === 5) {
                    this.MDR = this.memory[this.MAR];
                    this.microStepInfo = {
                        tStateName: 'T5',
                        phase: 'EXECUTE',
                        rtl: `MDR ← RAM[MAR] [0x${this.toHex4(this.MDR)}]`,
                        controlSignals: ['MEM_read', 'MDR_in'],
                        activeComponents: ['Memory', 'MDR'],
                        activeBuses: ['bus_mar_mem', 'bus_mem_mdr']
                    };
                    this.tState = 6;
                } else if (this.tState === 6) {
                    this.ACC = (this.ACC | this.MDR) & 0xFFFF;
                    this.updateFlags(this.ACC);
                    this.microStepInfo = {
                        tStateName: 'T6',
                        phase: 'EXECUTE',
                        rtl: `ACC ← ACC | MDR [0x${this.toHex4(this.ACC)}], Flags [Z=${this.flags.Z}, N=${this.flags.N}]`,
                        controlSignals: ['ALU_or', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ALU', 'ACC', 'FLAGS', 'MDR'],
                        activeBuses: ['bus_acc_alu', 'bus_mdr_alu', 'bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // SHL (0x0A): AC ← AC << 1
            case 0x0A:
                if (this.tState === 4) {
                    const shifted = this.ACC << 1;
                    const carry = (shifted & 0x10000) !== 0;
                    this.ACC = shifted & 0xFFFF;
                    this.updateFlags(this.ACC, carry);
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `ACC ← AC << 1 [0x${this.toHex4(this.ACC)}], Carry = ${this.flags.C}`,
                        controlSignals: ['ALU_shl', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ALU', 'ACC', 'FLAGS'],
                        activeBuses: ['bus_acc_alu', 'bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // SHR (0x1E): AC ← AC >> 1
            case 0x1E:
                if (this.tState === 4) {
                    const carry = (this.ACC & 0x01) !== 0;
                    this.ACC = (this.ACC >> 1) & 0xFFFF;
                    this.updateFlags(this.ACC, carry);
                    this.microStepInfo = {
                        tStateName: 'T4',
                        phase: 'EXECUTE',
                        rtl: `ACC ← AC >> 1 [0x${this.toHex4(this.ACC)}], Carry = ${this.flags.C}`,
                        controlSignals: ['ALU_shr', 'ACC_in', 'Flags_set'],
                        activeComponents: ['ALU', 'ACC', 'FLAGS'],
                        activeBuses: ['bus_acc_alu', 'bus_alu_acc']
                    };
                    this.finishInstruction();
                }
                break;

            // HLT (0x3F): Halt clock generator
            case 0x3F:
                this.isHalted = true;
                this.microStepInfo = {
                    tStateName: `T${this.tState}`,
                    phase: 'HALTED',
                    rtl: 'HLT: Clock generator stopped. CPU halted.',
                    controlSignals: ['HLT_signal'],
                    activeComponents: ['ControlUnit'],
                    activeBuses: []
                };
                this.logMessage(`[CPU HALTED] Program execution finished at PC = 0x${this.toHex2(this.PC)}.`);
                break;

            default:
                // Unsupported / Unknown opcode
                this.microStepInfo = {
                    tStateName: `T${this.tState}`,
                    phase: 'EXECUTE',
                    rtl: `Unrecognized opcode 0x${this.toHex2(opcode)}. Treating as NOP.`,
                    controlSignals: ['NOP'],
                    activeComponents: ['ControlUnit'],
                    activeBuses: []
                };
                this.finishInstruction();
                break;
        }
    }

    /**
     * Finish instruction execution and check interrupt line
     */
    finishInstruction() {
        this.instructionCount++;

        // End of execution cycle: probe INTR and IE
        if (this.INTR === 1 && this.IE === 1) {
            this.logMessage(`[INTERRUPT TRIGGERED] Servicing INTR line. Entering Interrupt Cycle (T_INT0 - T_INT4).`);
            this.phase = 'INTERRUPT';
            this.tState = 0; // T_INT0
        } else {
            // Normal transition back to FETCH T0
            this.phase = 'FETCH';
            this.tState = 0;
        }
    }

    /**
     * INTERRUPT Phase: T_INT0 to T_INT4
     * As defined in theoretical reference:
     * - T_INT0: Probe INTR & IE, assert INTA
     * - T_INT1: SP ← SP - 1, MAR ← SP, MDR ← PC
     * - T_INT2: RAM[MAR] ← MDR (Push PC)
     * - T_INT3: SP ← SP - 1, MAR ← SP, MDR ← ACC, RAM[MAR] ← MDR (Push ACC)
     * - T_INT4: PC ← ISR_VECTOR (0x28), IE ← 0, clear INTR
     */
    stepInterruptPhase() {
        if (this.tState === 0) {
            // T_INT0: Hardware probe & acknowledge
            this.INTA = 1;
            this.microStepInfo = {
                tStateName: 'T_INT0',
                phase: 'INTERRUPT',
                rtl: 'Interrupt Check: INTR probed high with IE=1. Hardware asserts INTA signal.',
                controlSignals: ['INTA_assert', 'Probe_INTR'],
                activeComponents: ['ControlUnit'],
                activeBuses: []
            };
            this.tState = 1;
        } else if (this.tState === 1) {
            // T_INT1: Decrement SP and push PC
            this.SP = (this.SP - 1) & 0xFF;
            this.MAR = this.SP;
            this.MDR = this.PC;
            this.microStepInfo = {
                tStateName: 'T_INT1',
                phase: 'INTERRUPT',
                rtl: `Stack Preservation (PC): SP ← SP - 1 [0x${this.toHex2(this.SP)}], MAR ← SP, MDR ← PC [0x${this.toHex2(this.PC)}]`,
                controlSignals: ['SP_dec', 'MAR_in', 'PC_out', 'MDR_in'],
                activeComponents: ['SP', 'MAR', 'PC', 'MDR'],
                activeBuses: ['bus_sp_mar', 'bus_pc_mdr']
            };
            this.tState = 2;
        } else if (this.tState === 2) {
            // T_INT2: Memory write PC to stack
            this.memory[this.MAR] = this.MDR;
            this.microStepInfo = {
                tStateName: 'T_INT2',
                phase: 'INTERRUPT',
                rtl: `RAM[MAR] ← MDR [Pushed return PC (0x${this.toHex2(this.MDR)}) onto Stack Frame]`,
                controlSignals: ['MEM_write'],
                activeComponents: ['Memory', 'MDR'],
                activeBuses: ['bus_mdr_mem']
            };
            this.tState = 3;
        } else if (this.tState === 3) {
            // T_INT3: Decrement SP and push ACC & Flags
            this.SP = (this.SP - 1) & 0xFF;
            this.MAR = this.SP;
            this.MDR = this.ACC;
            this.memory[this.MAR] = this.MDR;
            this.microStepInfo = {
                tStateName: 'T_INT3',
                phase: 'INTERRUPT',
                rtl: `Stack Preservation (ACC): SP ← SP - 1 [0x${this.toHex2(this.SP)}], MAR ← SP, RAM[SP] ← ACC [0x${this.toHex4(this.ACC)}]`,
                controlSignals: ['SP_dec', 'MAR_in', 'ACC_out', 'MDR_in', 'MEM_write'],
                activeComponents: ['SP', 'MAR', 'ACC', 'MDR', 'Memory'],
                activeBuses: ['bus_sp_mar', 'bus_acc_mdr', 'bus_mdr_mem']
            };
            this.tState = 4;
        } else if (this.tState === 4) {
            // T_INT4: Vector branch & disable IE
            this.PC = this.ISR_VECTOR;
            this.IE = 0;
            this.INTR = 0;
            this.INTA = 0;
            this.microStepInfo = {
                tStateName: 'T_INT4',
                phase: 'INTERRUPT',
                rtl: `Vector Branch: PC ← 0x${this.toHex2(this.ISR_VECTOR)} (ISR Address), IE ← 0 (Disabled to prevent re-entrant collision)`,
                controlSignals: ['Vector_load', 'IE_clear', 'INTR_ack_done'],
                activeComponents: ['PC', 'ControlUnit'],
                activeBuses: []
            };
            this.logMessage(`[ISR ENTRY] Branched to ISR at address 0x${this.toHex2(this.ISR_VECTOR)}. Interrupts disabled.`);
            this.phase = 'FETCH';
            this.tState = 0;
        }
    }

    /**
     * Step an entire instruction (all T-states from T0 to next T0)
     */
    stepInstruction() {
        if (this.isHalted) return false;

        let safetyLimit = 30; // Prevent infinite loops in a single instruction step
        let stepsTaken = 0;

        do {
            this.stepMicro();
            stepsTaken++;
        } while (!this.isHalted && this.tState !== 0 && stepsTaken < safetyLimit);

        return true;
    }

    /**
     * Two-Pass Assembler
     * Supports labels, hex (0x..), decimal, .word directive, .org directive, comments (;)
     */
    assemble(sourceCode) {
        const lines = sourceCode.split('\n');
        const symbolTable = {};
        const parsedLines = [];
        let currentAddress = 0x00;

        // Pass 1: Parse symbols & determine addresses
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            let line = lines[lineIndex].trim();
            // Remove comments
            const commentIndex = line.indexOf(';');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex).trim();
            }

            if (!line) continue;

            // Check for label
            const labelMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*):(.*)$/);
            if (labelMatch) {
                const label = labelMatch[1];
                symbolTable[label] = currentAddress;
                line = labelMatch[2].trim();
            }

            if (!line) continue;

            // Directives or instructions
            const parts = line.split(/\s+/);
            const token = parts[0].toUpperCase();

            if (token === '.ORG') {
                const addr = this.parseValue(parts[1], symbolTable);
                currentAddress = addr & 0xFF;
                parsedLines.push({ type: 'ORG', addr: currentAddress, lineNum: lineIndex + 1 });
            } else if (token === '.WORD') {
                parsedLines.push({
                    type: 'DATA',
                    addr: currentAddress,
                    valToken: parts[1] || '0',
                    lineNum: lineIndex + 1
                });
                currentAddress = (currentAddress + 1) & 0xFF;
            } else {
                // Instruction
                const mnemonic = token;
                const operandToken = parts[1] || null;
                parsedLines.push({
                    type: 'INSTR',
                    addr: currentAddress,
                    mnemonic: mnemonic,
                    operandToken: operandToken,
                    lineNum: lineIndex + 1
                });
                currentAddress = (currentAddress + 1) & 0xFF;
            }
        }

        // Pass 2: Generate machine code words
        const assembledProgram = [];
        const newMemory = new Uint16Array(this.memorySize);

        for (const item of parsedLines) {
            if (item.type === 'ORG') {
                continue;
            } else if (item.type === 'DATA') {
                const val = this.parseValue(item.valToken, symbolTable);
                newMemory[item.addr] = val & 0xFFFF;
                assembledProgram.push({
                    addr: item.addr,
                    hex: this.toHex4(newMemory[item.addr]),
                    source: `.word ${item.valToken}`,
                    lineNum: item.lineNum
                });
            } else if (item.type === 'INSTR') {
                const opcode = this.mnemonicToOpcode[item.mnemonic];
                if (opcode === undefined) {
                    throw new Error(`Line ${item.lineNum}: Unknown mnemonic '${item.mnemonic}'`);
                }

                const def = this.ISA[opcode];
                let operand = 0x00;
                if (def.hasOperand) {
                    if (!item.operandToken) {
                        throw new Error(`Line ${item.lineNum}: Instruction '${item.mnemonic}' requires an operand/address`);
                    }
                    operand = this.parseValue(item.operandToken, symbolTable) & 0xFF;
                }

                const word = ((opcode & 0xFF) << 8) | (operand & 0xFF);
                newMemory[item.addr] = word;
                assembledProgram.push({
                    addr: item.addr,
                    hex: this.toHex4(word),
                    source: `${item.mnemonic} ${item.operandToken || ''}`.trim(),
                    lineNum: item.lineNum
                });
            }
        }

        return {
            memory: newMemory,
            symbolTable: symbolTable,
            assembledProgram: assembledProgram
        };
    }

    /**
     * Parses number or label
     */
    parseValue(token, symbolTable) {
        if (!token) return 0;
        token = token.trim();
        // Check symbol table
        if (symbolTable && symbolTable.hasOwnProperty(token)) {
            return symbolTable[token];
        }
        // Hexadecimal 0x..
        if (token.toLowerCase().startsWith('0x')) {
            return parseInt(token, 16);
        }
        // Binary 0b..
        if (token.toLowerCase().startsWith('0b')) {
            return parseInt(token.substring(2), 2);
        }
        // Decimal
        const val = parseInt(token, 10);
        return isNaN(val) ? 0 : val;
    }

    /**
     * Disassembles a 16-bit word at given address
     */
    disassemble(word) {
        const opcode = (word >> 8) & 0xFF;
        const operand = word & 0xFF;
        const def = this.ISA[opcode];
        if (!def) {
            return word === 0 ? 'NOP / 0x0000' : `.word 0x${this.toHex4(word)}`;
        }
        if (def.hasOperand) {
            return `${def.mnemonic} 0x${this.toHex2(operand)}`;
        }
        return def.mnemonic;
    }

    /**
     * Helpers for formatting
     */
    toHex2(num) {
        return (num & 0xFF).toString(16).toUpperCase().padStart(2, '0');
    }

    toHex4(num) {
        return (num & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }

    toBin16(num) {
        return (num & 0xFFFF).toString(2).padStart(16, '0');
    }

    logMessage(msg) {
        const timestamp = new Date().toLocaleTimeString();
        this.traceLog.unshift({ timestamp, text: msg });
        if (this.traceLog.length > this.maxLogLength) {
            this.traceLog.pop();
        }
    }
}

// Preset Programs (Basic Addition, Multiplication, Count Sum Loop, and Factorial)
const PRESET_PROGRAMS = {
    add: {
        name: "1. Basic Addition (ADD)",
        description: "Loads num1 (15), adds num2 (27), stores in sum (42), and outputs to display.",
        code: `; ============================================
; Program 1: Basic Addition (ADD)
; Description: Loads num1, adds num2,
;              stores to sum, outputs to OUT
; ============================================
    LDI 15        ; Load 15 into ACC
    STA num1      ; Save to num1
    LDI 27        ; Load 27 into ACC
    STA num2      ; Save to num2
    LDA num1      ; Load num1
    ADD num2      ; ACC = ACC + num2 (15 + 27 = 42)
    STA sum       ; Store in sum
    OUT           ; Output 42
    HLT           ; Halt

num1: .word 0
num2: .word 0
sum:  .word 0
`
    },

    mul_hw: {
        name: "2. Hardware Multiplication (MUL)",
        description: "Multiplies 7 * 6 = 42 using the MUL instruction in 8 clock cycles.",
        code: `; ============================================
; Program 2: Hardware Multiplication (MUL)
; Description: Multiplies two numbers using MUL
;              Opcode 0x05 (8 clock cycles)
; ============================================
    LDI 7         ; Load 7 into ACC
    STA val1      ; Save to val1
    LDI 6         ; Load 6 into ACC
    STA val2      ; Save to val2
    LDA val1      ; ACC = 7
    MUL val2      ; ACC = 7 * 6 = 42
    STA product   ; Store result
    OUT           ; Output 42
    HLT           ; Halt

val1:    .word 0
val2:    .word 0
product: .word 0
`
    },

    count_sum: {
        name: "3. Count Sum Loop (Sum 1 to N)",
        description: "Calculates sum of numbers from 1 to N (5 + 4 + 3 + 2 + 1 = 15).",
        code: `; ============================================
; Program 3: Count Sum (Loop: Sum 1 to N)
; Description: Calculates sum of 1 to N
;              (e.g., N=5: 5+4+3+2+1 = 15)
; ============================================
    LDI 5         ; Set N = 5
    STA count     ; Store in counter variable
    LDI 0         ; Initialize sum = 0
    STA sum

loop:
    LDA count     ; Load counter (updates flags)
    JZ  done      ; If counter == 0, exit loop
    ADD sum       ; ACC = count + sum
    STA sum       ; Save new sum
    OUT           ; Output running sum
    
    LDA count     ; Decrement counter
    DEC
    STA count
    JMP loop      ; Loop back

done:
    LDA sum       ; Load final sum (15)
    OUT           ; Output 15
    HLT           ; Halt

count: .word 0
sum:   .word 0
`
    },

    factorial: {
        name: "4. Factorial Calculation (N!)",
        description: "Calculates factorial of N (e.g., 4! = 4 * 3 * 2 * 1 = 24) using loop and multiplication (MUL).",
        code: `; ============================================
; Program 4: Factorial Calculation (N!)
; Description: Calculates 4! = 24 using loop
;              and multiplication (MUL)
; ============================================
    LDI 4         ; Set N = 4
    STA n         ; Store in n
    LDI 1         ; Initialize fact = 1
    STA fact

fact_loop:
    LDA n         ; Check if n == 0
    JZ  fact_done ; If n == 0, finished
    MUL fact      ; ACC = n * fact
    STA fact      ; Save updated factorial
    OUT           ; Output running factorial
    
    LDA n         ; Load n
    DEC           ; Decrement: n = n - 1
    STA n
    JMP fact_loop ; Repeat loop

fact_done:
    LDA fact      ; Load final result (24)
    OUT           ; Output final 24
    HLT           ; Halt

n:    .word 0
fact: .word 0
`
    }
};

// Export to window or node environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CPUEngine, PRESET_PROGRAMS };
} else {
    window.CPUEngine = CPUEngine;
    window.PRESET_PROGRAMS = PRESET_PROGRAMS;
}
