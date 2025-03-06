# Underground Snake Explorer

A 3D snake exploration game where you dig through the earth's layers to discover treasures. Built with Next.js and Three.js.

## Features

- Choose from 4 different snake types with unique abilities
- First-person and isometric view modes
- Dig through realistic earth layers (topsoil, bedrock, mantle, etc.)
- Discover and collect rare minerals and treasures
- Dynamic lighting that adapts to your depth
- Procedurally generated world with caves and structures
- Inventory system to track your discoveries
- Mouse-based first-person controls for immersive exploration

## Technologies Used

- Next.js for the application framework
- Three.js for 3D rendering and physics
- React Three Fiber for React integration with Three.js
- React Three Drei for advanced Three.js components
- Pointer Lock Controls for immersive first-person navigation

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. The game uses basic color materials instead of textures for simplicity:
   ```bash
   mkdir -p public/textures
   ```
   Placeholder texture files have been created, but they're not actually used in the current implementation.

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to play the game.

## How to Play

1. Select a snake type:
   - Desert Sidewinder: Balanced speed and digging ability
   - Cave Python: Strong with excellent digging power
   - Jungle Viper: Fast but with less digging power
   - Magma Serpent: Exceptional digging power but less durable

2. Controls:
   - W/↑: Move Forward
   - S/↓: Move Backward
   - A/←: Turn Left
   - D/→: Turn Right
   - E: Dig Down
   - Q: Dig Up
   - V: Toggle between First-Person and Isometric views
   - Click: Lock mouse for first-person control
   - ESC: Unlock mouse

## Earth Layers

As you dig deeper, you'll encounter different layers of the earth:
- Surface (0-5m): Grass, dirt, and stone
- Topsoil (5-10m): Dirt, clay, and stone
- Subsoil (10-15m): Clay, gravel, and stone
- Bedrock (15-20m): Stone, basalt, and granite
- Upper Crust (20-30m): Granite, basalt, and mineral veins
- Lower Crust (30-40m): Gneiss, schist, and magma pockets
- Mantle (40-50m): Magma, minerals, and rare gems

## Collectible Treasures

Throughout your journey, you'll find various treasures:
- Common: Stone, Iron Ore, Copper Ore
- Uncommon: Silver Ore, Ancient Fossils
- Rare: Gold Nuggets, Emeralds, Rubies
- Very Rare: Diamonds, Magma Crystals

The deeper you dig, the more valuable treasures you can find!

## Tips for Success

- Different snake types excel at different depths
- Toggle between view modes to get a better sense of your surroundings
- Your headlamp will automatically activate in darker depths
- Watch your inventory to track your discoveries
- The environment changes visually as you dig deeper
- Some layers require more dig power to penetrate