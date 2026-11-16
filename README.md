# CPU Instruction Cycle & Datapath Simulator
### Computer Organization and Architecture (COA) Final Project

A clean, visual, and interactive CPU architecture simulator designed to demonstrate computer organization principles at the **micro-operation (T-State)** and **interrupt cycle** levels.

---

## 🌟 Core Architecture & Features

1. **Cycle & Micro-Operation Simulation**:
   - **Fetch Phase ($T_0 - T_2$)**:
     - $T_0$: $MAR \leftarrow PC$
     - $T_1$: $MDR \leftarrow RAM[MAR]$, $PC \leftarrow PC + 1$
     - $T_2$: $IR \leftarrow MDR$
   - **Decode Phase ($T_3$)**:
     - Control Unit extracts opcode, resolves addressing modes, and sets control signals.
   - **Execute Phase ($T_4 - T_7$)**:
     - ALU operations, memory reads/writes, branch tests ($JZ$, $JNZ$), and accumulator updates.
   - **Interrupt Phase ($T_{INT0} - T_{INT4}$)**:
     - Probes $INTR$ line and $IE$ flip-flop; saves return $PC$ and Accumulator ($AC$) onto stack; branches to vector `0x28`; restores via `IRET`.

2. **Interactive Datapath (Matches Architecture Reference)**:
   - Blocks: **PC, MAR, Memory, MDR, IR, Control Unit, SP, ACC, ALU, FLAGS, OUTPUT**.
   - Active blocks and buses glow with animated electrical pulses during data transfers:
     - **Address Bus**: Glowing cyan
     - **Data Bus**: Glowing emerald green
     - **ALU Path**: Glowing purple
   - Live Micro-Operation Banner right below the Datapath displays the exact Register Transfer Level (RTL) notation and asserted control signals.

3. **Preloaded Programs**:
   - **1. Basic Addition (`ADD`)**: Loads two variables, adds them in Accumulator, writes result to RAM, and outputs to display.
   - **2. Hardware Multiplication (`MUL`)**: Executes single-instruction multiplication ($AC \leftarrow AC \times RAM[addr]$) in 8 clock cycles.
   - **3. Count Sum Loop (Sum 1 to N)**: Calculates $1 + 2 + \dots + N$ (e.g., $5 + 4 + 3 + 2 + 1 = 15$) using loop accumulation.
   - **4. Factorial Calculation (N!)**: Calculates $4! = 4 \times 3 \times 2 \times 1 = 24$ using a loop and the `MUL` instruction.

4. **Integrated Two-Pass Assembler & RAM Inspector**:
   - Write assembly code with labels (`loop:`), variables (`.word`), origin directives (`.org`), and immediate values (`LDI`).
   - RAM table highlights active $PC$, $MAR$, $SP$, and $ISR$ vector addresses in real time.

---

## 🌐 Live Demo

**[Open the simulator](https://cpu-instruction-cycle-simulator-five.vercel.app/)**: runs in any browser, nothing to install.

---

## 🚀 How to Run

**Online:** open the live demo link above.

**Locally:**

1. Clone or download this repository:
   ```
   git clone https://github.com/saicharan065/CPU_INSTRUCTION_CYCLE_SIMULATOR.git
   ```
2. Open the project folder and double-click **`index.html`** to open it in any web browser (Chrome, Edge, Firefox, Safari). No build step or server is needed.
3. Select any program from the **Program** dropdown (e.g. *Count Sum Loop*, *Software Loop Multiplication*, or *Basic Addition*).
4. Click **Run** (<kbd>Space</kbd>) or **Step Micro (T-State)** (<kbd>S</kbd>) to watch the CPU execute cycle by cycle!

---

## 🛠 Tech Stack

HTML, CSS and vanilla JavaScript (`cpu-engine.js`, `datapath-view.js`, `app.js`). Deployed on Vercel.

---

## 👤 Author

Samudrala Sai Charan, B.Tech CSE, SRM University AP
[GitHub](https://github.com/saicharan065)
