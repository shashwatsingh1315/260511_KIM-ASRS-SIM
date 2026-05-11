# 🏭 ASRS-Choker: Factory & Logistics Planning Engine

Welcome to the **ASRS-Choker**! This is a web-based mathematical modeling and visualization tool designed to simulate, plan, and analyze warehouse and factory logistics. 

It specifically focuses on identifying bottlenecks (the "Choke" points) in automated storage and retrieval systems (ASRS), production lines, and the physical transport edges (conveyors, elevators) connecting them.

---

## 📖 Table of Contents
1. [What does this app do?](#-what-does-this-app-do)
2. [Tech Stack & Architecture](#-tech-stack--architecture)
3. [Core Concepts (The Glossary)](#-core-concepts-the-glossary)
4. [How the Mathematical Engine Works](#-how-the-mathematical-engine-works)
5. [Step-by-Step Usage Guide](#-step-by-step-usage-guide-for-interns)
6. [Local Development Setup](#-local-development-setup)
7. [Repository Structure](#-repository-structure)

---

## 🎯 What does this app do?
Imagine a factory that produces 50,000 smart meters a day. You have Raw Materials coming in on trucks, moving to an ASRS (Automated Warehouse), then to Sub-Assembly, then Final Assembly. 
* Do you have enough space (footprint) to hold the pallets?
* Are the elevators moving fast enough to feed the assembly line?
* How many pallets are stuck in transit (WIP)?

**ASRS-Choker answers these questions.** You input your physical layout, your materials, your Bill of Materials (BOM), and your production targets. The app runs a reverse-propagation math engine to tell you exactly where your factory will fail (bottlenecks) before you actually build it.

---

## 🛠 Tech Stack & Architecture

This application is built with modern web technologies:
* **Framework:** Next.js 15 (App Router)
* **Styling:** Tailwind CSS v4 (Apple macOS Light Mode Aesthetic)
* **State Management:** Zustand (for complex client-side engine state)
* **Database / Sync:** Upstash Redis Serverless

### Hybrid Local-First Sync ☁️+💻
The app uses a unique hybrid sync strategy to ensure it feels lightning-fast while keeping data safe:
1. When you load the app, it pulls all data from Upstash Redis and saves it to your browser's `localStorage`.
2. When you make a change (e.g., add a material), it saves to `localStorage` *instantly* so the UI updates with zero lag.
3. In the background, it syncs the change up to Upstash. 
4. **Offline Mode:** If you lose internet, you can keep working! The app has an "Offline Mode" indicator and a "Download Backup" button to save your setup as a JSON file.

---

## 🧠 Core Concepts (The Glossary)

To use this app, you must understand how it models a factory. Data must be entered in a specific order because concepts rely on each other.

1. **🏗 Cells:** Physical 2D zones in the factory (e.g., "Warehouse Floor 1", "Assembly Room"). They have a Length and Width.
2. **📦 Packaging:** How things are boxed. (e.g., "10 units per Box", "5 Boxes per Pallet"). 
3. **🧱 Materials:** The physical items. Can be Raw Materials (RM), Semi-Finished Goods (SFG), or Finished Goods (FG).
4. **⚙️ Processes:** The actions taken on materials.
   * `hold`: Just storing the item (like an ASRS).
   * `status-change`: Quality control (Pass/Fail).
   * `identity-change`: Assembly. This uses a **BOM (Bill of Materials)**. Example: *1 Plastic + 1 PCBA = 1 Smart Meter*.
5. **🗺 Routes:** The journey a material takes. Example: *Receive → Store in ASRS → Assemble*.
6. **🏭 Stations:** The actual machines or zones where a Process happens. Stations live inside Cells. You assign production targets (units per hour) here.
7. **🛤 Edges:** The physical connections between Cells (e.g., a Lane, a Bridge, an Elevator). They have a maximum pallet-per-hour capacity.

---

## 🧮 How the Mathematical Engine Works

The core of the app lives in `src/lib/engine.ts`. When you click "Run Engine" on the Analysis tab, here is what happens:

1. **Demand Propagation (The Pull System):**
   It finds the Stations that produce Finished Goods and looks at their "Target Units per Hour". It then walks *backward* through the Bill of Materials (BOM) to calculate exactly how many Raw Materials are needed to hit that target, factoring in yield/scrap rates.
2. **Step Throughput:**
   It converts the required units per hour into **Pallets per Hour** based on your Packaging configurations.
3. **Little's Law (WIP):**
   *Work In Progress = Throughput × Residence Time*. It calculates how many pallets will be sitting at each station at any given moment.
4. **Capacity Checking:**
   It checks if the required throughput exceeds a Station's peak capacity, or if the required WIP exceeds a Station's holding capacity.
5. **Edge Routing Check:**
   It traces the routes. If a route moves from Cell A to Cell B, it finds the Edge connecting them. It sums up all the pallets crossing that Edge and alerts you if the Edge's capacity is exceeded.

---

## 👶 Step-by-Step Usage Guide (For Interns)

If you are tasked with setting up a simulation, **follow this exact order**:

1. **Go to Cells:** Create your physical rooms (e.g., "Dock", "Warehouse", "Production").
2. **Go to Packaging:** Define your boxes and pallets.
3. **Go to Materials:** Create your items (e.g., Plastic, PCBA, Meter). Assign them their packaging.
4. **Go to Processes:** Define what happens to them. 
   * *Crucial Step:* If you create an Assembly process (identity-change), save it first, then click "Edit BOM Inputs" to define what goes into it!
5. **Go to Routes:** For every material, define the steps it goes through. (e.g., Plastic goes through `Receive` → `Store`).
6. **Go to Stations:** Place your processes into your physical Cells. Tell the system how many pallets a station can hold, and what its target output is.
7. **Go to Edges:** Define how pallets move between Cells (e.g., an Elevator between "Warehouse" and "Production").
8. **Go to Analysis:** Click **Run Engine**. Look for red alerts! If an Edge is at 150% utilization, you have a bottleneck and need to add another elevator or slow down production.

---

## 💻 Local Development Setup

To run this repository on your local machine:

### Prerequisites
* Node.js 18+
* An Upstash Redis database (Free tier is fine)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root of the project and add your Upstash credentials:
```env
UPSTASH_REDIS_REST_URL="https://your-upstash-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-super-secret-token"
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Repository Structure

```text
260508_ASRS-Choker/
├── src/
│   ├── app/                  # Next.js App Router (UI Pages)
│   │   ├── actions/db.ts     # Server actions for Upstash Redis communication
│   │   ├── analysis/         # The Dashboard output UI
│   │   ├── layout.tsx        # Main application layout
│   │   └── ... (other pages)
│   ├── components/           # Reusable React components (Sidebar, DataTable)
│   ├── lib/                  
│   │   ├── collections.ts    # Hybrid Sync Logic (Local Storage + Upstash)
│   │   ├── engine.ts         # The Math Engine! (Demand propagation, WIP, Edge checks)
│   │   └── validation.ts     # Pre-engine sanity checks
│   ├── store/
│   │   └── useAppStore.ts    # Zustand global state management
│   └── types/
│       └── index.ts          # TypeScript interfaces for the entire system
├── docs/                     # Agent planning and specification documents
└── package.json              # Project dependencies
```
