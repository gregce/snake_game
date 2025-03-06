import { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Box, Sphere, Sky, Text, Environment, FirstPersonControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

// World constants
const WORLD_SIZE = 160 // Much larger world for better exploration
const GRID_SIZE = 80 // Larger grid size for more movement space
const VOXEL_SIZE = 2 
const WORLD_DEPTH = 30 // Reduced depth since we're focusing on isometric play
const SNAKE_SPEED = 0.1 // Increased speed for better frame rate
const AI_SNAKE_SPEED_MULTIPLIER = 0.6 // Make AI snakes a bit slower for better visibility
const CAMERA_OFFSET = [30, 40, 30] // Higher isometric view for improved snake visibility
const CAMERA_TARGET_OFFSET = [0, 0, 0] // Where to look
const SMOOTH_FACTOR = 0.15 // Higher value for snappier camera response
const MAX_VISIBLE_DISTANCE = 50 // Further reduced for better performance
const SNAKE_ELEVATION = 2.5 // Significantly higher elevation to ensure snake is always visible

// Performance settings - highly optimized
const MAX_VOXELS = 100 // Reduced maximum terrain voxels
const MAX_PARTICLES = 10 // Minimal trail particles
const MAX_COLLECTIBLES = 20 // Maximum collectibles to prevent GPU overload
const MAX_INVENTORY_SIZE = 10 // Maximum number of items player can hold
const SHOW_FPS = true // Whether to show FPS counter

// Snake growing mechanics - significantly limited for better performance
const INITIAL_SNAKE_LENGTH = 10 // Changed from 10 to 2 as requested
const MAX_SNAKE_LENGTH = 30 // Much lower maximum length to prevent slowdown
const INITIAL_SNAKE_FATNESS = 1.0 // Starting fatness scale
const MAX_SNAKE_FATNESS = 5.0 // Maximum fatness before explosion
const FATNESS_GROWTH_PER_FOOD = 0.01 // How much fatter the snake gets per food (reduced from 0.05)
const GROWTH_PER_FOOD = 1 // Grow very slowly to ensure visibility and performance
const SNAKE_SEGMENT_SPACING = 1.0 // More spacing between segments for better visibility

// Terrain layers
const LAYERS = [
  { name: 'Surface', depth: 5, color: '#3a7d44', materials: ['grass', 'dirt', 'stone'] },
  { name: 'Topsoil', depth: 10, color: '#795548', materials: ['dirt', 'clay', 'stone'] },
  { name: 'Subsoil', depth: 15, color: '#5d4037', materials: ['clay', 'gravel', 'stone'] },
  { name: 'Bedrock', depth: 20, color: '#455a64', materials: ['stone', 'basalt', 'granite'] },
  { name: 'Upper Crust', depth: 30, color: '#37474f', materials: ['granite', 'basalt', 'mineral veins'] },
  { name: 'Lower Crust', depth: 40, color: '#263238', materials: ['gneiss', 'schist', 'magma pockets'] },
  { name: 'Mantle', depth: 50, color: '#bf360c', materials: ['magma', 'minerals', 'rare gems'] }
]

// Materials and collectibles by depth
const COLLECTIBLES = [
  // Standard treasures (score only)
  { name: 'Common Stone', depth: 0, color: '#9e9e9e', rarity: 'common', value: 1, type: 'treasure' },
  { name: 'Iron Ore', depth: 10, color: '#8d6e63', rarity: 'common', value: 2, type: 'treasure' },
  { name: 'Copper Ore', depth: 15, color: '#d4ac0d', rarity: 'common', value: 3, type: 'treasure' },
  { name: 'Silver Ore', depth: 20, color: '#e0e0e0', rarity: 'uncommon', value: 5, type: 'treasure' },
  { name: 'Gold Nugget', depth: 25, color: '#ffeb3b', rarity: 'rare', value: 10, type: 'treasure' },
  { name: 'Emerald', depth: 30, color: '#4caf50', rarity: 'rare', value: 15, type: 'treasure' },
  { name: 'Ruby', depth: 35, color: '#e53935', rarity: 'rare', value: 20, type: 'treasure' },
  { name: 'Diamond', depth: 40, color: '#b3e5fc', rarity: 'very rare', value: 30, type: 'treasure' },
  { name: 'Ancient Fossil', depth: 20, color: '#795548', rarity: 'uncommon', value: 12, type: 'treasure' },
  { name: 'Magma Crystal', depth: 45, color: '#ff5722', rarity: 'very rare', value: 25, type: 'treasure' },
  
  // Food items that make the snake grow
  { name: 'Apple', depth: 0, color: '#ff6b6b', rarity: 'common', value: 3, type: 'food', growthAmount: 1, glowColor: '#ffaaaa', emissiveIntensity: 0.5 },
  { name: 'Blueberry', depth: 5, color: '#5b7bff', rarity: 'common', value: 2, type: 'food', growthAmount: 1, glowColor: '#aabbff', emissiveIntensity: 0.5 },
  { name: 'Banana', depth: 0, color: '#ffec5f', rarity: 'common', value: 4, type: 'food', growthAmount: 2, glowColor: '#ffffaa', emissiveIntensity: 0.6 },
  { name: 'Golden Apple', depth: 15, color: '#ffbb33', rarity: 'rare', value: 12, type: 'food', growthAmount: 3, glowColor: '#ffdd88', emissiveIntensity: 0.8 },
  { name: 'Crystal Fruit', depth: 25, color: '#cc99ff', rarity: 'rare', value: 15, type: 'food', growthAmount: 4, glowColor: '#eeccff', emissiveIntensity: 0.8 },
  
  // Special power-up items
  { name: 'Speed Boost', depth: 10, color: '#00ddff', rarity: 'rare', value: 8, type: 'powerup', effect: 'speed', duration: 15, glowColor: '#88ffff', emissiveIntensity: 1.0 },
  { name: 'Invincibility', depth: 20, color: '#ffcc00', rarity: 'very rare', value: 18, type: 'powerup', effect: 'invincible', duration: 10, glowColor: '#ffffaa', emissiveIntensity: 1.0 },
  { name: 'Treasure Magnet', depth: 10, color: '#44ff44', rarity: 'uncommon', value: 7, type: 'powerup', effect: 'magnet', duration: 20, glowColor: '#aaffaa', emissiveIntensity: 0.7 }
]

// Snake varieties
const SNAKE_TYPES = [
  { 
    name: 'Desert Sidewinder', 
    color: '#ffcc66', // Brighter, more visible yellow-orange
    headColor: '#ee9933',
    glowColor: '#ffe0b2',
    texture: 'scales1', 
    speed: 0.14, 
    digPower: 1.0, 
    strength: 1.2,
    segmentShape: 'box', // cube-shaped segments
    trailColor: '#ffeecc' // Color for the trail effect
  },
  { 
    name: 'Cave Python', 
    color: '#5577cc', // Brighter blue-purple
    headColor: '#334499',
    glowColor: '#7799ff',
    texture: 'scales2', 
    speed: 0.12, 
    digPower: 1.5, 
    strength: 1.5,
    segmentShape: 'sphere', // sphere-shaped segments
    trailColor: '#aabbff' // Color for the trail effect
  },
  { 
    name: 'Jungle Viper', 
    color: '#44dd44', // Vibrant green
    headColor: '#22aa22',
    glowColor: '#88ff88',
    texture: 'scales3', 
    speed: 0.16, 
    digPower: 0.8, 
    strength: 1.0,
    segmentShape: 'diamond', // diamond-shaped segments
    trailColor: '#ccffcc' // Color for the trail effect
  },
  { 
    name: 'Magma Serpent', 
    color: '#ff5533', // Brighter red-orange
    headColor: '#dd3311',
    glowColor: '#ffaa88',
    texture: 'scales4', 
    speed: 0.13, 
    digPower: 2.0, 
    strength: 0.9,
    segmentShape: 'cylinder', // cylinder-shaped segments
    trailColor: '#ffccbb' // Color for the trail effect
  }
]

// AI Snake types - these are the other snakes in the environment
const AI_SNAKE_TYPES = [
  { 
    name: 'Wild Cobra', 
    color: '#ffdd44', // Brighter yellow
    headColor: '#ffaa00',
    glowColor: '#ffffaa',
    segmentShape: 'sphere',
    behavior: 'wanderer', // wanders around randomly
    trailColor: '#ffffcc', // Color for the trail effect
    emissiveIntensity: 0.3 // Light emission for better visibility
  },
  { 
    name: 'Rock Worm', 
    color: '#cc9977', // Brighter brown
    headColor: '#aa7755',
    glowColor: '#ddbbaa',
    segmentShape: 'cylinder',
    behavior: 'digger', // digs tunnels underground
    trailColor: '#ddccbb', // Color for the trail effect
    emissiveIntensity: 0.2 // Light emission for better visibility
  },
  { 
    name: 'Crystal Serpent', 
    color: '#cc88ff', // Vibrant purple
    headColor: '#aa55dd',
    glowColor: '#ddaaff',
    segmentShape: 'diamond',
    behavior: 'follower', // follows the player at a distance
    trailColor: '#eeccff', // Color for the trail effect
    emissiveIntensity: 0.4 // Light emission for better visibility
  }
]

// Controls
const KEYS = {
  UP: ['w', 'W', 'ArrowUp'],
  DOWN: ['s', 'S', 'ArrowDown'],
  LEFT: ['a', 'A', 'ArrowLeft'],
  RIGHT: ['d', 'D', 'ArrowRight'],
  DIG_DOWN: ['e', 'E'],
  DIG_UP: ['q', 'Q'],
  TOGGLE_VIEW: ['v', 'V'],
  PAUSE: [' ']
}

// Helper functions
const getLayerByDepth = (depth) => {
  return LAYERS.find((layer, index) => {
    const nextLayer = LAYERS[index + 1]
    return depth < layer.depth || !nextLayer || depth < nextLayer.depth
  }) || LAYERS[LAYERS.length - 1]
}

const getRandomCollectible = (depth) => {
  const possibleCollectibles = COLLECTIBLES.filter(c => c.depth <= depth)
  if (possibleCollectibles.length === 0) return null
  
  // Rarer items are less likely to appear
  const weights = possibleCollectibles.map(c => {
    const depthFactor = 1 - Math.abs(c.depth - depth) / depth // Items matching current depth are more likely
    let rarityFactor = 1
    if (c.rarity === 'common') rarityFactor = 2
    if (c.rarity === 'uncommon') rarityFactor = 0.5
    if (c.rarity === 'rare') rarityFactor = 0.2
    if (c.rarity === 'very rare') rarityFactor = 0.05
    return depthFactor * rarityFactor
  })
  
  // Weighted random selection
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let randomValue = Math.random() * totalWeight
  
  for (let i = 0; i < weights.length; i++) {
    randomValue -= weights[i]
    if (randomValue <= 0) {
      return possibleCollectibles[i]
    }
  }
  
  return possibleCollectibles[0]
}

// Optimized terrain voxel component
function TerrainVoxel({ position, size, color, opacity = 1, onClick, geometry }) {
  // If a shared geometry is provided, use it instead of creating a new one
  const voxelGeometry = geometry || useMemo(() => new THREE.BoxGeometry(size, size, size), [size])
  
  // Use a material cache for improved performance
  const materialKey = `${color}-${opacity < 1 ? opacity : 1}`
  const materialCache = useRef({})
  
  const voxelMaterial = useMemo(() => {
    // Check if we already have a material with these properties
    if (materialCache.current[materialKey]) {
      return materialCache.current[materialKey]
    }
    
    // Otherwise create a new material and cache it
    const material = new THREE.MeshStandardMaterial({ 
      color, 
      transparent: opacity < 1, 
      opacity,
      roughness: 0.7,
      // Reduce shadow quality for better performance
      shadowSide: THREE.FrontSide,
      // Fewer render passes for better performance
      flatShading: true
    })
    
    materialCache.current[materialKey] = material
    return material
  }, [color, opacity, materialKey])
  
  return (
    <mesh 
      position={position} 
      geometry={voxelGeometry} 
      material={voxelMaterial} 
      onClick={onClick}
      receiveShadow
      // Only cast shadows for voxels that are close to the camera
      castShadow={position[1] > 0} // Better performance by limiting shadow casters
    />
  )
}

// Collectible component
function Collectible({ item, position, onCollect }) {
  // Choose geometry based on item type
  const geometry = useMemo(() => {
    if (item.type === 'food') {
      // Food items are slightly larger for better visibility
      return new THREE.SphereGeometry(VOXEL_SIZE * 0.4, 16, 16);
    } else if (item.type === 'powerup') {
      // Power-ups use a star-like geometry
      return new THREE.OctahedronGeometry(VOXEL_SIZE * 0.4, 1);
    } else {
      // Regular treasures
      return new THREE.SphereGeometry(VOXEL_SIZE * 0.3, 16, 16);
    }
  }, [item.type]);
  
  // Enhanced materials based on item type
  const material = useMemo(() => {
    const emissiveIntensity = item.emissiveIntensity || 
                             (item.type === 'food' ? 0.6 : 
                              item.type === 'powerup' ? 0.8 : 0.3);
    
    const glowColor = item.glowColor || item.color;
    
    return new THREE.MeshStandardMaterial({ 
      color: item.color, 
      emissive: glowColor, 
      emissiveIntensity: emissiveIntensity,
      roughness: item.type === 'food' ? 0.1 : 0.2,
      metalness: item.type === 'treasure' ? 0.8 : 0.4
    });
  }, [item]);
  
  // Different rotation behavior based on item type
  const [rotation, setRotation] = useState([0, 0, 0]);
  const [hoverEffect, setHoverEffect] = useState(1.0);
  const [pulseDirection, setPulseDirection] = useState(1);
  
  // Animation frame logic
  useFrame((_, delta) => {
    // Rotation animation
    if (item.type === 'powerup') {
      // Power-ups have more dynamic rotation on all axes
      setRotation([
        rotation[0] + delta * 0.7,
        rotation[1] + delta * 1.2,
        rotation[2] + delta * 0.5
      ]);
    } else if (item.type === 'food') {
      // Food items bounce and spin
      setRotation([
        0,
        rotation[1] + delta * 1.5,
        0
      ]);
      
      // Add pulsing/hovering effect for food items
      setHoverEffect(prev => {
        let newValue = prev + (delta * 0.5 * pulseDirection);
        if (newValue > 1.2) {
          newValue = 1.2;
          setPulseDirection(-1);
        } else if (newValue < 0.9) {
          newValue = 0.9;
          setPulseDirection(1);
        }
        return newValue;
      });
    } else {
      // Regular treasure rotation
      setRotation([
        rotation[0],
        rotation[1] + delta * 1.2,
        rotation[0]
      ]);
    }
  });
  
  return (
    <group position={position}>
      {/* Main collectible item with glowing effect */}
      <group scale={hoverEffect}>
        <mesh 
          geometry={geometry} 
          material={material}
          rotation={rotation}
          onClick={onCollect}
          receiveShadow
          castShadow
        />
        
        {/* Add glow effect for food and powerups */}
        {(item.type === 'food' || item.type === 'powerup') && (
          <pointLight
            intensity={item.emissiveIntensity || 0.5}
            distance={VOXEL_SIZE * 4}
            color={item.glowColor || item.color}
          />
        )}
        
        {/* Special effects for different item types */}
        {item.type === 'food' && (
          // Particles around food items
          <group>
            {[...Array(4)].map((_, i) => (
              <mesh 
                key={i}
                position={[
                  Math.sin(rotation[1] + i * Math.PI/2) * VOXEL_SIZE * 0.5,
                  Math.cos(rotation[1] + i * Math.PI/2) * VOXEL_SIZE * 0.2,
                  Math.cos(rotation[1] + i * Math.PI/2) * VOXEL_SIZE * 0.5
                ]}
                scale={0.15}
              >
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial 
                  color={item.glowColor || '#ffffff'} 
                  emissive={item.glowColor || '#ffffff'}
                  emissiveIntensity={0.8}
                  transparent={true}
                  opacity={0.7}
                />
              </mesh>
            ))}
          </group>
        )}
        
        {item.type === 'powerup' && (
          // Orbital ring for powerups
          <mesh rotation={[Math.PI/2, 0, 0]}>
            <ringGeometry args={[VOXEL_SIZE * 0.6, VOXEL_SIZE * 0.65, 32]} />
            <meshStandardMaterial 
              color={item.color}
              emissive={item.glowColor || item.color}
              emissiveIntensity={0.7}
              transparent={true}
              opacity={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
      
      {/* Text label with enhanced visibility */}
      <Text
        position={[0, VOXEL_SIZE * 0.6, 0]}
        fontSize={item.type === 'food' || item.type === 'powerup' ? 0.5 : 0.4}
        color={item.type === 'food' ? '#ffffff' : item.type === 'powerup' ? '#ffff99' : 'white'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="black"
      >
        {item.name}
      </Text>
      
      {/* Additional info for powerups */}
      {item.type === 'powerup' && (
        <Text
          position={[0, VOXEL_SIZE * 0.9, 0]}
          fontSize={0.25}
          color="#aaffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="black"
        >
          {`Special: ${item.effect} (${item.duration}s)`}
        </Text>
      )}
    </group>
  )
}

// Snake segment component with enhanced visuals
function SnakeSegment({ position, rotation, isHead, type, scale = 1, isDigging = false, segmentIndex = 0, totalSegments = 1, isAI = false, scaleFactor = 1.0 }) {
  // Create geometry based on snake type
  const segmentGeometry = useMemo(() => {
    const sizeFactor = isHead ? 1.1 : 1.0
    const headScale = isHead ? scale * 1.2 : scale
    
    // Size falls off slightly toward the tail for a tapered look
    // Apply the additional scaleFactor parameter for more control
    const tailFactor = isHead ? 1 : Math.max(0.6, 1 - segmentIndex / totalSegments * 0.5) * scaleFactor
    
    // Choose geometry based on snake type
    switch(type.segmentShape) {
      case 'sphere':
        return new THREE.SphereGeometry(
          VOXEL_SIZE * 0.5 * headScale * tailFactor, 
          16, 16
        )
      case 'cylinder':
        return new THREE.CylinderGeometry(
          VOXEL_SIZE * 0.4 * headScale * tailFactor, 
          VOXEL_SIZE * 0.4 * headScale * tailFactor * 0.8,
          VOXEL_SIZE * 0.9 * headScale,
          8, 1
        )
      case 'diamond':
        return new THREE.OctahedronGeometry(
          VOXEL_SIZE * 0.5 * headScale * tailFactor, 
          1
        )
      case 'box':
      default:
        // Box with slightly rounded corners for the default option
        const width = VOXEL_SIZE * 0.8 * headScale * tailFactor
        const height = VOXEL_SIZE * 0.6 * headScale * tailFactor
        const depth = VOXEL_SIZE * (isHead ? 1.1 : 0.9) * headScale * tailFactor
        return new THREE.BoxGeometry(width, height, depth, 1, 1, 1)
    }
  }, [isHead, scale, type.segmentShape, segmentIndex, totalSegments, scaleFactor])
  
  // Enhanced materials with glow effects
  const segmentMaterial = useMemo(() => {
    // Use head color for head, regular color for body
    const baseColor = isHead ? type.headColor || type.color : type.color
    
    // Add glowing outline for better visibility
    // Head is brightest, body segments fade slightly toward the tail
    const emissiveFactor = isHead ? 0.8 : 
                          isDigging ? 0.9 : 
                          Math.max(0.4, 0.7 - (segmentIndex / totalSegments) * 0.3);
    
    const emissiveColor = isDigging ? (type.glowColor || type.color) : (type.glowColor || type.color)
    
    // Enhanced material with stronger glow for better visibility
    return new THREE.MeshStandardMaterial({ 
      color: baseColor,
      roughness: 0.2, // Lower roughness for more shine
      metalness: 0.3, // Higher metalness for better contrast
      emissive: emissiveColor, // Use glow for better visibility
      emissiveIntensity: emissiveFactor, // Increased glow to make snake stand out more
      flatShading: false,
    })
  }, [type, isHead, isDigging, segmentIndex, totalSegments])
  
  // Enhanced eye components
  const eyeGeometry = useMemo(() => new THREE.SphereGeometry(VOXEL_SIZE * 0.12 * scale, 16, 16), [scale])
  const eyeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ffffff',
    emissive: isDigging ? '#ffffff' : '#cccccc', 
    emissiveIntensity: isDigging ? 0.7 : 0.3,
    metalness: 0.5,
    roughness: 0.2
  }), [isDigging])
  
  const pupilGeometry = useMemo(() => new THREE.SphereGeometry(VOXEL_SIZE * 0.06 * scale, 16, 16), [scale])
  const pupilMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#000000',
    metalness: 0.8,
    roughness: 0.1
  }), [])
  
  // Calculate offset for segment connections
  // This creates a slight gap between segments for better visibility
  const offsetFactor = 0.9 
  
  // Generate random tongue movement
  const [tongueRotation, setTongueRotation] = useState([0, 0, 0])
  useEffect(() => {
    if (!isHead) return
    
    const interval = setInterval(() => {
      // Random tongue flicking
      if (Math.random() > 0.7) {
        setTongueRotation([
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          0.2 + Math.random() * 0.2
        ])
      }
    }, 200)
    
    return () => clearInterval(interval)
  }, [isHead])
  
  // Body segments have a subtle pulsing effect for better visibility
  const [pulseScale, setPulseScale] = useState(1.0)
  useEffect(() => {
    if (isHead) return
    
    const interval = setInterval(() => {
      setPulseScale(0.95 + Math.random() * 0.1)
    }, 500 + segmentIndex * 100)
    
    return () => clearInterval(interval)
  }, [isHead, segmentIndex])
  
  // Glow effect when digging
  const glowIntensity = isDigging ? 0.8 : 0
  
  return (
    <group position={position} rotation={rotation}>
      {/* Main segment body */}
      <mesh 
        geometry={segmentGeometry} 
        material={segmentMaterial} 
        receiveShadow 
        castShadow 
        scale={pulseScale}
      />
      
      {/* Connection between segments - small joint sphere */}
      {!isHead && segmentIndex > 0 && segmentIndex < totalSegments && (
        <mesh position={[0, 0, -VOXEL_SIZE * 0.45 * scale * offsetFactor]}>
          <sphereGeometry args={[VOXEL_SIZE * 0.25 * scale, 12, 12]} />
          <meshStandardMaterial 
            color={type.color} 
            emissive={type.glowColor || type.color}
            emissiveIntensity={0.4}
          />
        </mesh>
      )}
      
      {/* Add a visible connection "tube" between segments for better continuity */}
      {!isHead && segmentIndex > 0 && (
        <mesh position={[0, 0, -VOXEL_SIZE * 0.25 * scale * offsetFactor]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry 
            args={[
              VOXEL_SIZE * 0.22 * scale, // top radius
              VOXEL_SIZE * 0.26 * scale, // bottom radius (wider to connect to next segment)
              VOXEL_SIZE * 0.35 * scale, // height
              8 // radial segments
            ]} 
          />
          <meshStandardMaterial 
            color={type.color}
            emissive={type.glowColor || type.color}
            emissiveIntensity={0.3}
          />
        </mesh>
      )}
      
      {/* Head details */}
      {isHead && (
        <>
          {/* Left eye */}
          <mesh 
            position={[VOXEL_SIZE * 0.28 * scale, VOXEL_SIZE * 0.18 * scale, VOXEL_SIZE * 0.4 * scale]} 
            geometry={eyeGeometry} 
            material={eyeMaterial}
          />
          <mesh 
            position={[VOXEL_SIZE * 0.28 * scale, VOXEL_SIZE * 0.18 * scale, VOXEL_SIZE * 0.48 * scale]} 
            geometry={pupilGeometry} 
            material={pupilMaterial}
          />
          
          {/* Right eye */}
          <mesh 
            position={[-VOXEL_SIZE * 0.28 * scale, VOXEL_SIZE * 0.18 * scale, VOXEL_SIZE * 0.4 * scale]} 
            geometry={eyeGeometry} 
            material={eyeMaterial}
          />
          <mesh 
            position={[-VOXEL_SIZE * 0.28 * scale, VOXEL_SIZE * 0.18 * scale, VOXEL_SIZE * 0.48 * scale]} 
            geometry={pupilGeometry} 
            material={pupilMaterial}
          />
          
          {/* Tongue with animation */}
          <mesh 
            position={[0, -VOXEL_SIZE * 0.15 * scale, VOXEL_SIZE * 0.6 * scale]} 
            rotation={tongueRotation}
          >
            <boxGeometry args={[VOXEL_SIZE * 0.03 * scale, VOXEL_SIZE * 0.02 * scale, VOXEL_SIZE * 0.4 * scale]} />
            <meshStandardMaterial 
              color="#FF0000" 
              emissive="#AA0000"
              emissiveIntensity={0.5}
            />
          </mesh>
          
          {/* Snake markings - patterns on the head */}
          <mesh 
            position={[0, VOXEL_SIZE * 0.35 * scale, 0]} 
            rotation={[Math.PI/2, 0, 0]}
          >
            <planeGeometry args={[VOXEL_SIZE * 0.6 * scale, VOXEL_SIZE * 0.8 * scale]} />
            <meshStandardMaterial 
              color={type.headColor || type.color} 
              opacity={0.7}
              transparent
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
      
      {/* Glow effect when digging */}
      {isDigging && isHead && (
        <pointLight
          position={[0, 0, 0]}
          intensity={glowIntensity}
          distance={VOXEL_SIZE * 3}
          color={type.glowColor || type.color}
        />
      )}
    </group>
  )
}

// Isometric controls for arcade-style gameplay
function IsometricControlsWrapper({ enabled, onMove }) {
  const { camera, gl } = useThree()
  const keysPressed = useRef({})
  const lastUpdateTime = useRef(0)
  
  useEffect(() => {
    if (!enabled) return
    
    // Key press tracking for smoother movement
    const handleKeyDown = (e) => {
      keysPressed.current[e.key] = true
    }
    
    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false
    }
    
    // Set up continuous movement handling
    const updateMovement = () => {
      const now = Date.now()
      const deltaTime = (now - lastUpdateTime.current) / 1000 // seconds
      lastUpdateTime.current = now
      
      if (!enabled) return
      
      // Calculate movement vector from keys pressed
      let dx = 0
      let dz = 0
      
      // Isometric controls - adapted for grid-based movement
      // Forward/backward (W/S or Up/Down)
      if (KEYS.UP.some(key => keysPressed.current[key])) {
        // In isometric view, "up" is a diagonal movement
        dx -= 0.7
        dz -= 0.7
      }
      if (KEYS.DOWN.some(key => keysPressed.current[key])) {
        // In isometric view, "down" is a diagonal movement
        dx += 0.7
        dz += 0.7
      }
      
      // Left/right (A/D or Left/Right)
      if (KEYS.LEFT.some(key => keysPressed.current[key])) {
        // In isometric view, "left" is a diagonal movement
        dx -= 0.7
        dz += 0.7
      }
      if (KEYS.RIGHT.some(key => keysPressed.current[key])) {
        // In isometric view, "right" is a diagonal movement
        dx += 0.7
        dz -= 0.7
      }
      
      // Normalize movement for consistent speed in all directions
      if (dx !== 0 || dz !== 0) {
        const length = Math.sqrt(dx*dx + dz*dz)
        dx /= length
        dz /= length
        
        // Apply movement
        onMove(dx, 0, dz)
      }
      
      requestAnimationFrame(updateMovement)
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    lastUpdateTime.current = Date.now()
    const animationId = requestAnimationFrame(updateMovement)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(animationId)
    }
  }, [enabled, onMove])
  
  return null
}

// Layer indicator
function LayerIndicator({ currentDepth, fps }) {
  const currentLayer = getLayerByDepth(Math.abs(currentDepth))
  
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      left: 10,
      padding: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '4px',
      color: 'white',
      fontFamily: 'monospace',
      pointerEvents: 'none'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px'
      }}>
        <div style={{
          width: '14px',
          height: '14px',
          backgroundColor: currentLayer.color,
          borderRadius: '3px'
        }}></div>
        <div>{currentLayer.name}</div>
      </div>
      <div>Depth: {Math.abs(currentDepth).toFixed(1)}m</div>
      <div>Materials: {currentLayer.materials.join(', ')}</div>
      <div style={{
        marginTop: '5px',
        color: fps > 45 ? '#00ff00' : fps > 30 ? '#ffff00' : '#ff0000',
        fontWeight: 'bold',
      }}>
        {fps || 0} FPS
      </div>
    </div>
  )
}

// World generation manager
function WorldManager({ selectedSnakeType, inventory, setInventory, onTreasureCollect, onGameStateUpdate, score, setScore }) {
  const [terrain, setTerrain] = useState({})
  const [collectibles, setCollectibles] = useState([])
  const [snake, setSnake] = useState([])
  const [direction, setDirection] = useState([0, 0, 1]) // Forward initially
  const [viewMode, setViewMode] = useState('first-person') // 'first-person' or 'isometric'
  const [snakeLength, setSnakeLength] = useState(INITIAL_SNAKE_LENGTH) // Track desired snake length
  const [moveCounter, setMoveCounter] = useState(0);
  const [snakeFatness, setSnakeFatness] = useState(INITIAL_SNAKE_FATNESS); // Track snake fatness
  const [isExploding, setIsExploding] = useState(false); // Track explosion state
  const [bloodParticles, setBloodParticles] = useState([]); // Blood particles for explosion
  // In the WorldManager component, add explosion enhancement variables
  const [screenShake, setScreenShake] = useState(0);
  const [explosionLight, setExplosionLight] = useState(false);
  const [explosionIntensity, setExplosionIntensity] = useState(0);
  // Preload explosion sound
  const explosionSoundRef = useRef(null);
  
  // Define score thresholds for snake growth
  const scoreThresholds = [
    500,    // First growth at 500 points
    2000,   // Second growth at 2000 points
    5000,   // Third growth at 5000 points
    10000,  // Fourth growth at 10000 points
    20000   // Fifth growth at 20000 points
  ];
  
  // Track the last threshold reached
  const [lastThresholdReached, setLastThresholdReached] = useState(-1)
  
  // PowerUp system - track active powerups
  const [powerups, setPowerups] = useState({
    speed: { active: false, timeLeft: 0 },
    invincible: { active: false, timeLeft: 0 },
    magnet: { active: false, timeLeft: 0 }
  })
  
  // Trail effect for better visibility
  const [trail, setTrail] = useState([])
  
  // AI snakes that share the environment
  const [aiSnakes, setAiSnakes] = useState([])
  
  const { camera } = useThree()
  const snakeTypeRef = useRef(selectedSnakeType)
  
  // Initialize world
  useEffect(() => {
    snakeTypeRef.current = selectedSnakeType;
    resetWorld();
    
    // Start in first-person view mode as requested
    setViewMode('first-person');
    
    // Save preferred view mode
    window.localStorage.setItem('preferredViewMode', 'first-person');
    
    // Set up window resize handler for responsive gameplay
    const handleResize = () => {
      // Camera adjustments on resize for consistent view
      if (camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedSnakeType]);
  
  // Reset world
  const resetWorld = () => {
    // Initialize snake with starting position
    let initialSnake = [];
    const startX = 0;
    const startZ = 0;
    const startY = SNAKE_ELEVATION;
    
    // Set initial direction - snake facing forward
    const initialDirection = [0, 0, 1];
    setDirection(initialDirection);
    
    // Create head
    initialSnake.push({
      position: [startX, startY, startZ],
      rotation: [0, 0, 0]
    });
    
    // Create initial body segments
    // Ensure the snake has a body from the beginning
    const segmentSpacing = SNAKE_SEGMENT_SPACING * VOXEL_SIZE; // Use both constants for proper spacing
    for (let i = 1; i < INITIAL_SNAKE_LENGTH; i++) {
      // Position segments in a line behind the head using the initial direction
      initialSnake.push({
        // Use negative direction to place segments behind the head
        position: [
          startX - (initialDirection[0] * i * segmentSpacing),
          startY,
          startZ - (initialDirection[2] * i * segmentSpacing)
        ],
        rotation: [0, 0, 0]
      });
    }
    
    setSnake(initialSnake);
    
    // Generate initial terrain chunks around snake
    const initialTerrain = {};
    generateTerrainChunks(initialSnake[0].position, 4, initialTerrain);
    setTerrain(initialTerrain);
    
    // Generate initial collectibles with more food items
    let initialCollectibles = [
      // Add some guaranteed food items near the starting area
      ...generateFoodNearPosition([5, SNAKE_ELEVATION, 5], 3),
      ...generateFoodNearPosition([-5, SNAKE_ELEVATION, 5], 2),
      ...generateFoodNearPosition([0, SNAKE_ELEVATION, 10], 2),
      // Then add regular collectibles
      ...generateCollectiblesNear(initialSnake[0].position, initialTerrain)
    ];
    
    // Limit initial collectibles to prevent GPU overload
    if (initialCollectibles.length > MAX_COLLECTIBLES) {
      initialCollectibles = initialCollectibles.slice(0, MAX_COLLECTIBLES);
    }
    
    setCollectibles(initialCollectibles);
    
    // Generate AI snakes - 3 other snakes in the environment
    generateAiSnakes(initialSnake[0].position, initialTerrain);
    
    // Reset all tracking variables
    setInventory([]);
    setMoveCounter(0);
    
    // Reset powerups when game starts
    setPowerups({
      speed: { active: false, timeLeft: 0 },
      invincible: { active: false, timeLeft: 0 },
      magnet: { active: false, timeLeft: 0 }
    });
    
    // Reset other game state
    setSnakeLength(INITIAL_SNAKE_LENGTH);
    setScore(0);
    setSnakeFatness(INITIAL_SNAKE_FATNESS);
  }
  
  // Helper function to generate food items near a position
  const generateFoodNearPosition = (basePosition, count) => {
    const foodItems = [];
    
    // Filter only food items
    const foodTypes = COLLECTIBLES.filter(item => item.type === 'food');
    
    for (let i = 0; i < count; i++) {
      // Random offset
      const offset = [
        (Math.random() - 0.5) * 8,
        0,
        (Math.random() - 0.5) * 8
      ];
      
      // Random food item
      const randomFood = foodTypes[Math.floor(Math.random() * foodTypes.length)];
      
      foodItems.push({
        id: Math.random().toString(36).substr(2, 9),
        item: randomFood,
        position: [
          basePosition[0] + offset[0],
          basePosition[1],
          basePosition[2] + offset[2]
        ]
      });
    }
    
    return foodItems;
  }
  
  // Generate AI snakes
  const generateAiSnakes = (playerPosition, terrain) => {
    const newAiSnakes = []
    
    // Create 3 AI snakes, one of each type
    AI_SNAKE_TYPES.forEach((aiType, index) => {
      // Place AI snakes at different locations
      const spawnOffsets = [
        [20, 0, 20],  // Far corner
        [-15, -5, 10], // Underground
        [5, 2, -25]    // Other side
      ]
      
      const [offsetX, offsetY, offsetZ] = spawnOffsets[index % spawnOffsets.length]
      
      // Create the AI snake
      const aiSnake = {
        id: `ai-snake-${index}`,
        type: aiType,
        segments: [],
        direction: [Math.random() > 0.5 ? 1 : -1, 0, Math.random() > 0.5 ? 1 : -1],
        behavior: aiType.behavior,
        moveCounter: 0,
        lastUpdate: 0
      }
      
      // Create 4-6 segments
      const segmentCount = 4 + Math.floor(Math.random() * 3)
      
      for (let i = 0; i < segmentCount; i++) {
        // Position segments in a line
        aiSnake.segments.push({
          position: [
            playerPosition[0] + offsetX + (i * 0.8 * aiSnake.direction[0]),
            playerPosition[1] + offsetY,
            playerPosition[2] + offsetZ + (i * 0.8 * aiSnake.direction[2])
          ],
          rotation: [0, Math.atan2(aiSnake.direction[0], aiSnake.direction[2]), 0]
        })
      }
      
      newAiSnakes.push(aiSnake)
    })
    
    setAiSnakes(newAiSnakes)
  }
  
  // Create stylish game board 
  const generateGameBoard = () => {
    const board = {}
    
    // Create a flat isometric playing field with grid cells
    const boardSize = GRID_SIZE
    const halfSize = boardSize / 2
    
    // Main playing surface - flat with grid pattern
    for (let x = -halfSize; x <= halfSize; x += 1) {
      for (let z = -halfSize; z <= halfSize; z += 1) {
        const key = `${x*VOXEL_SIZE},0,${z*VOXEL_SIZE}`
        
        // Cell color alternates in checker pattern
        const isEven = (x + z) % 2 === 0
        const cellColor = isEven ? '#358141' : '#2a662f'
        
        // Don't create cells outside the circular boundary
        const distFromCenter = Math.sqrt(x*x + z*z)
        if (distFromCenter > halfSize * 0.95) continue
        
        board[key] = {
          position: [x * VOXEL_SIZE, 0, z * VOXEL_SIZE],
          color: cellColor,
          layerName: 'Surface',
          depth: 0,
          isGridCell: true
        }
      }
    }
    
    // Add decorative border around the playing field
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 80) {
      const radius = halfSize * VOXEL_SIZE
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      
      const key = `${Math.round(x)},0,${Math.round(z)}`
      board[key] = {
        position: [x, 0, z],
        color: '#1a4527',
        layerName: 'Border',
        depth: 0,
        isBorder: true
      }
      
      // Add rim slightly below
      const rimKey = `${Math.round(x)},-1,${Math.round(z)}`
      board[rimKey] = {
        position: [x, -VOXEL_SIZE, z],
        color: '#0d3319',
        layerName: 'Rim',
        depth: 1,
        isBorder: true
      }
    }
    
    // Add some decorative elements and obstacles
    const obstacles = [
      // Stone formations
      { pos: [10, 0, 10], size: 2, color: '#777' },
      { pos: [-15, 0, -5], size: 3, color: '#888' },
      { pos: [5, 0, -20], size: 2, color: '#999' },
      // Water pools
      { pos: [-5, -0.5, 15], size: 4, color: '#3498db' },
      { pos: [20, -0.5, -10], size: 3, color: '#2980b9' },
      // Power-up platforms
      { pos: [0, 0.5, 25], size: 2, color: '#f1c40f' },
      { pos: [-25, 0.5, -25], size: 2, color: '#e67e22' },
      { pos: [25, 0.5, 25], size: 2, color: '#9b59b6' }
    ]
    
    // Add obstacles to the board
    obstacles.forEach(obstacle => {
      const [ox, oy, oz] = obstacle.pos
      const size = obstacle.size
      
      for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
          // Make circular obstacles
          const distFromCenter = Math.sqrt(x*x + z*z)
          if (distFromCenter > size) continue
          
          const key = `${(ox + x)*VOXEL_SIZE},${oy*VOXEL_SIZE},${(oz + z)*VOXEL_SIZE}`
          board[key] = {
            position: [(ox + x) * VOXEL_SIZE, oy * VOXEL_SIZE, (oz + z) * VOXEL_SIZE],
            color: obstacle.color,
            layerName: 'Obstacle',
            depth: 0,
            isObstacle: true
          }
        }
      }
    })
    
    return board
  }
  
  // Simplified terrain generation - optimized for performance
  const generateTerrainChunks = (centerPos, radius, currentTerrain) => {
    // For isometric mode, we just use a pre-defined game board
    if (Object.keys(currentTerrain).length === 0) {
      return generateGameBoard()
    }
    
    // Otherwise, just return the current terrain
    return currentTerrain
  }
  
  // Generate collectibles near a position
  const generateCollectiblesNear = (position, terrain) => {
    const [px, py, pz] = position
    const radius = 10
    const newCollectibles = []
    
    // Consider only 5% of terrain voxels for collectibles
    const terrainKeys = Object.keys(terrain)
    const sampleSize = Math.floor(terrainKeys.length * 0.05)
    const sampledKeys = []
    
    for (let i = 0; i < sampleSize && i < terrainKeys.length; i++) {
      const randomIndex = Math.floor(Math.random() * terrainKeys.length)
      sampledKeys.push(terrainKeys[randomIndex])
      terrainKeys.splice(randomIndex, 1) // Remove to avoid duplicates
    }
    
    for (const key of sampledKeys) {
      const voxel = terrain[key]
      const [x, y, z] = voxel.position
      
      // Only place collectibles below the surface
      if (voxel.depth < 2) continue
      
      // Calculate distance to snake position
      const distance = Math.sqrt(
        Math.pow(x - px, 2) + 
        Math.pow(y - py, 2) + 
        Math.pow(z - pz, 2)
      )
      
      // Only place collectibles within a certain radius but not too close
      if (distance > radius * VOXEL_SIZE || distance < 3 * VOXEL_SIZE) continue
      
      // Random chance to place a collectible
      if (Math.random() > 0.7) {
        // Higher chance for collectible in deeper layers
        const collectible = getRandomCollectible(voxel.depth)
        if (collectible) {
          // Check if position is empty (not inside terrain)
          const aboveKey = `${x},${y+VOXEL_SIZE},${z}`
          if (!terrain[aboveKey]) {
            newCollectibles.push({
              id: Math.random().toString(36).substr(2, 9),
              item: collectible,
              position: [x, y + VOXEL_SIZE, z]
            })
          }
        }
      }
    }
    
    return newCollectibles
  }
  
  // Handle snake movement - optimized for isometric gameplay
  const moveSnake = (dx, dy, dz) => {
    setSnake(prevSnake => {
      if (prevSnake.length === 0) return prevSnake
      
      const head = { ...prevSnake[0] }
      const newDirection = [dx, 0, dz] // Keep y at 0 for isometric movement
      
      // Normalize direction vector for consistent speed
      const dirMagnitude = Math.sqrt(dx*dx + dz*dz)
      if (dirMagnitude > 0) {
        dx = dx / dirMagnitude
        dz = dz / dirMagnitude
        
        // Update direction if there's actual movement
        setDirection([dx, 0, dz])
      }
      
      // Apply speed boost powerup if active
      let currentSpeed = SNAKE_SPEED * snakeTypeRef.current.speed
      if (powerups && powerups.speed && powerups.speed.active) {
        currentSpeed *= 1.5 // 50% speed boost
      }
      
      // Calculate new head position - with elevation to prevent terrain clipping
      const newHeadPos = [
        head.position[0] + dx * currentSpeed,
        SNAKE_ELEVATION, // Keep snake elevated above terrain
        head.position[2] + dz * currentSpeed
      ]
      
      // Ultra-minimal trail system - just enough to show the snake's position
      // Only add trails very occasionally for performance
      if (frameCounter.current % 15 === 0 && Math.random() > 0.5) { // Much less frequent
        // Just mark head and tail and nothing else
        const newParticles = [];
        
        // Mark the head
        newParticles.push({
          position: [...head.position],
          color: '#ffffff', // White is very visible
          size: 0.25,
          life: 10 // Very short life
        });
        
        // Mark the tail if the snake is long enough
        if (prevSnake.length >= 6 && prevSnake[prevSnake.length - 1]) {
          newParticles.push({
            position: [...prevSnake[prevSnake.length - 1].position],
            color: '#ff5555', // Red for tail
            size: 0.25,
            life: 10
          });
        }
        
        // Keep absolute minimum particles for performance
        setTrail(prev => {
          // Hard limit to very few particles
          const trimmedPrev = prev.slice(-5 + newParticles.length);
          return [...trimmedPrev, ...newParticles];
        });
      }
      
      // Keep snake within game board boundaries
      const boardRadius = GRID_SIZE / 2 * VOXEL_SIZE * 0.9
      const distFromCenter = Math.sqrt(newHeadPos[0]**2 + newHeadPos[2]**2)
      
      if (distFromCenter > boardRadius) {
        // Prevent movement beyond the circular game board
        newHeadPos[0] = head.position[0]
        newHeadPos[2] = head.position[2]
      }
      
      // Calculate rotation based on direction - smoother for arcade feel
      const targetRotation = Math.atan2(dx, dz)
      
      // Smoothly interpolate rotation for natural turning
      let currentRotation = head.rotation[1]
      
      // Calculate shortest rotation path
      let rotationDiff = targetRotation - currentRotation
      while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2
      while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2
      
      // Apply smooth rotation with max turn rate
      const maxTurnRate = 0.2
      const newRotationY = currentRotation + Math.min(Math.max(rotationDiff, -maxTurnRate), maxTurnRate)
      
      const newHead = {
        position: newHeadPos,
        rotation: [0, newRotationY, 0] // No pitch in isometric view
      }
      
      // Treasure magnet powerup - attract nearby collectibles
      if (powerups && powerups.magnet && powerups.magnet.active) {
        setCollectibles(prev => {
          return prev.map(c => {
            const [cx, cy, cz] = c.position
            const [hx, hy, hz] = newHeadPos
            
            // Calculate distance to snake head
            const dist = Math.sqrt(
              Math.pow(cx - hx, 2) +
              Math.pow(cy - hy, 2) +
              Math.pow(cz - hz, 2)
            )
            
            // If collectible is within magnet range
            if (dist < VOXEL_SIZE * 15) {
              // Calculate direction vector to snake
              const dirX = (hx - cx) / dist
              const dirZ = (hz - cz) / dist
              
              // Move collectible toward snake (faster when closer)
              const magnetStrength = 0.2 * (1 - dist / (VOXEL_SIZE * 15))
              return {
                ...c,
                position: [
                  cx + dirX * magnetStrength,
                  cy,
                  cz + dirZ * magnetStrength
                ]
              }
            }
            
            return c
          })
        })
      }
      
      // Check if we're hitting terrain - improved digging with visual feedback
      const voxelKey = newHeadPos.map(Math.round).join(',')
      if (terrain[voxelKey]) {
        // Invincibility powerup lets us break any terrain
        const digPower = (powerups && powerups.invincible && powerups.invincible.active) ? 
                        999 : // Infinite dig power when invincible
                        snakeTypeRef.current.digPower * 3.0
                        
        const voxelDepth = terrain[voxelKey].depth
        
        // Ensure dig power is sufficient for the depth
        if (digPower >= voxelDepth) {
          // Dig multiple blocks at once for a more satisfying tunnel effect
          // This creates a tunnel instead of just a single block removal
          const digRadius = Math.max(1, Math.floor(digPower / 10))
          
          setTerrain(prev => {
            const newTerrain = { ...prev }
            
            // Remove the main block
            delete newTerrain[voxelKey]
            
            // Create a tunnel by removing nearby blocks in the direction of movement
            for (let i = 1; i <= digRadius; i++) {
              const tunnelPos = [
                Math.round(newHeadPos[0] + dx * i),
                Math.round(newHeadPos[1] + dy * i),
                Math.round(newHeadPos[2] + dz * i)
              ]
              const tunnelKey = tunnelPos.join(',')
              if (newTerrain[tunnelKey]) {
                delete newTerrain[tunnelKey]
              }
            }
            
            // Also remove blocks to the sides slightly to make a wider tunnel
            if (digRadius > 1) {
              const sideOffsets = [
                [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
              ]
              
              sideOffsets.forEach(offset => {
                const sidePos = [
                  Math.round(newHeadPos[0] + offset[0]),
                  Math.round(newHeadPos[1] + offset[1]),
                  Math.round(newHeadPos[2] + offset[2])
                ]
                const sideKey = sidePos.join(',')
                if (newTerrain[sideKey]) {
                  delete newTerrain[sideKey]
                }
              })
            }
            
            return newTerrain
          })
          
          // Add score for digging - more points for deeper digging
          setScore(prev => prev + Math.ceil(voxelDepth))
          
          // Add visual effect for digging - more collectibles when digging
          if (Math.random() > 0.6) {
            setTimeout(() => {
              setCollectibles(prev => {
                // Only add new collectibles if we haven't reached the maximum
                if (prev.length >= MAX_COLLECTIBLES) return prev;
                
                const newCollectibles = generateCollectiblesNear(newHeadPos, terrain);
                // Add only up to the limit
                const availableSlots = MAX_COLLECTIBLES - prev.length;
                const collectiblesToAdd = newCollectibles.slice(0, availableSlots);
                
                return [...prev, ...collectiblesToAdd];
              })
            }, 200)
          }
        } else {
          // Not enough dig power, don't move but provide visual feedback
          // We'll just slow down instead of completely stopping
          newHeadPos[0] = head.position[0] + dx * currentSpeed * 0.1
          newHeadPos[1] = head.position[1] + dy * currentSpeed * 0.1
          newHeadPos[2] = head.position[2] + dz * currentSpeed * 0.1
        }
      }
      
      // Generate new terrain chunks if needed
      setTerrain(prev => {
        const newTerrain = generateTerrainChunks(newHeadPos, 4, prev)
        return newTerrain
      })
      
      // Check for collectibles - with enhanced detection radius
      const collectibleRadius = (powerups && powerups.magnet && powerups.magnet.active) ? VOXEL_SIZE * 1.5 : VOXEL_SIZE

      // Only check for collectibles every few frames to prevent too rapid collection
      if (moveCounter % 4 === 0) { // Only check every 4 frames to slow down collection rate
        const collectibleIndex = collectibles.findIndex(c => {
          const [cx, cy, cz] = c.position
          const [sx, sy, sz] = newHeadPos
          const distance = Math.sqrt(
            Math.pow(cx - sx, 2) +
            Math.pow(cy - sy, 2) +
            Math.pow(cz - sz, 2)
          )
          return distance < collectibleRadius
        })
        
        if (collectibleIndex !== -1) {
          const collectible = collectibles[collectibleIndex]
          
          // Update inventory - check for duplicates first
          console.log('WorldManager (collision detection): Adding to inventory:', collectible.item.name)
          setInventory(prev => {
            // Check if an identical item already exists in the inventory
            const isDuplicate = prev.some(existingItem => 
              existingItem.name === collectible.item.name && 
              existingItem.type === collectible.item.type
            );
            
            // Only add if not a duplicate
            if (!isDuplicate) {
              return [...prev, collectible.item];
            } else {
              console.log('WorldManager (collision detection): Prevented duplicate item:', collectible.item.name);
              return prev;
            }
          });
          
          // Update score with the item value
          const itemValue = collectible.item.value * 10
          updateScoreAndFatness(itemValue);
          
          // SNAKE GROWTH is now handled by score thresholds, not by food items
          // So we just give visual feedback for collection
          setTrail(prev => [
            ...prev.slice(-MAX_PARTICLES + 1),
            {
              position: [...collectible.position],
              color: collectible.item.glowColor || '#ffffff',
              size: 0.4,
              life: 15
            }
          ]);
          
          // Handle powerup items
          if (collectible.item.type === 'powerup') {
            // Set the powerup as active
            setPowerups(prev => ({
              ...prev,
              [collectible.item.effect]: {
                active: true,
                timeLeft: collectible.item.duration || 10
              }
            }))
            
            // Visual feedback for powerup activation
            for (let i = 0; i < 12; i++) {
              setTimeout(() => {
                const angle = (i / 12) * Math.PI * 2
                const radius = VOXEL_SIZE * 2
                setTrail(prev => [
                  ...prev,
                  {
                    position: [
                      collectible.position[0] + Math.cos(angle) * radius,
                      collectible.position[1],
                      collectible.position[2] + Math.sin(angle) * radius
                    ],
                    color: collectible.item.glowColor || collectible.item.color,
                    size: 0.5,
                    life: 30
                  }
                ])
              }, i * 40)
            }
          }
          
          // Remove collectible
          setCollectibles(prev => prev.filter((_, i) => i !== collectibleIndex))
          
          // Call collect callback - pass the item value rather than the new total score
          onTreasureCollect(collectible.item, itemValue)
          
          // Generate new collectibles - much less frequent
          if (Math.random() > 0.97) { // Changed from 0.95 to 0.97 (even rarer - only 3% chance)
            setCollectibles(prev => {
              if (prev.length >= MAX_COLLECTIBLES) return prev;
              
              const newCollectibles = generateCollectiblesNear(newHeadPos, terrain);
              const availableSlots = Math.min(1, MAX_COLLECTIBLES - prev.length); // Max 1 new collectible (reduced from 2)
              const collectiblesToAdd = newCollectibles.slice(0, availableSlots);
              
              return [...prev, ...collectiblesToAdd];
            })
          }
          
          // Generate food items occasionally - even more rare
          if (Math.random() > 0.98) { // Changed from 0.97 to 0.98 (extremely rare - only 2% chance)
            setCollectibles(prev => {
              if (prev.length >= MAX_COLLECTIBLES) return prev;
              
              const newFoodItems = generateFoodNearPosition([
                newHeadPos[0] + (Math.random() - 0.5) * 30,
                SNAKE_ELEVATION,
                newHeadPos[2] + (Math.random() - 0.5) * 30
              ], 1);
              
              const availableSlots = Math.min(1, MAX_COLLECTIBLES - prev.length); // Max 1 new food
              const foodToAdd = newFoodItems.slice(0, availableSlots);
              
              return [...prev, ...foodToAdd];
            })
          }
        }
      }
      
      // Randomly generate new collectibles as we move
      if (Math.random() > 0.997) { // Changed from 0.995 to 0.997 (even rarer - only 0.3% chance per frame)
        setCollectibles(prev => {
          if (prev.length >= MAX_COLLECTIBLES * 0.8) return prev; // Only generate if we're below 80% capacity
          
          const newCollectibles = generateCollectiblesNear(newHeadPos, terrain);
          // Limit to just 1 new collectible at a time
          const availableSlots = Math.min(1, MAX_COLLECTIBLES - prev.length);
          const collectiblesToAdd = newCollectibles.slice(0, availableSlots);
          
          return [...prev, ...collectiblesToAdd];
        })
      }
      
      // Occasionally add food items - very rare
      if (Math.random() > 0.999) { // Changed from 0.998 to 0.999 (very rare - only 0.1% chance per frame)
        setCollectibles(prev => {
          if (prev.length >= MAX_COLLECTIBLES * 0.7) return prev; // Only generate if we're well below capacity
          
          const foodPosition = [
            newHeadPos[0] + (Math.random() - 0.5) * 40,
            SNAKE_ELEVATION,
            newHeadPos[2] + (Math.random() - 0.5) * 40
          ]
          
          const newFoodItems = generateFoodNearPosition(foodPosition, 1);
          // Just one food item at most
          const availableSlots = Math.min(1, MAX_COLLECTIBLES - prev.length);
          const foodToAdd = newFoodItems.slice(0, availableSlots);
          
          return [...prev, ...foodToAdd];
        })
      }
      
      // Create a new snake with dynamic length that can grow
      const newSnake = [newHead]
      
      // Create body segments using a direct follow algorithm that maintains consistent spacing
      if (prevSnake.length > 1 || dirMagnitude > 0) {
        // We have previous segments or we're moving in a direction
        // Use a chain-link approach where each segment directly follows the one in front
        
        const targetLength = Math.min(snakeLength, prevSnake.length > 1 ? prevSnake.length : snakeLength);
        
        for (let i = 1; i < targetLength; i++) {
          // Get the segment in front (the one this segment should follow)
          const segmentInFront = newSnake[i-1];
          
          // Calculate the position for this segment
          let newPos;
          let newRot;
          
          if (i < prevSnake.length) {
            // This segment already exists, just update its position to follow
            const prevSegment = prevSnake[i];
            
            // Calculate direction from front segment to its previous position
            const dirFromFront = [
              segmentInFront.position[0] - prevSnake[i-1].position[0],
              0,
              segmentInFront.position[2] - prevSnake[i-1].position[2]
            ];
            
            const dirLength = Math.sqrt(dirFromFront[0]**2 + dirFromFront[2]**2) || 0.001;
            
            // Normalize direction
            const normalizedDir = [
              dirFromFront[0] / dirLength,
              0,
              dirFromFront[2] / dirLength
            ];
            
            // Fixed segment spacing - use smaller spacing for a tight snake
            const spacing = SNAKE_SEGMENT_SPACING * 0.8;
            
            // Position this segment behind the segment in front along the movement direction
            newPos = [
              segmentInFront.position[0] - normalizedDir[0] * spacing,
              SNAKE_ELEVATION,
              segmentInFront.position[2] - normalizedDir[2] * spacing
            ];
            
            // Calculate rotation from movement direction
            newRot = [0, Math.atan2(normalizedDir[0], normalizedDir[2]), 0];
          } else {
            // This is a new segment being added to the end
            // Use direction from the last two segments to determine direction
            const lastSegment = newSnake[newSnake.length-1];
            const secondLastSegment = newSnake[newSnake.length-2] || lastSegment;
            
            // Direction from second-last to last segment
            const tailDir = [
              secondLastSegment.position[0] - lastSegment.position[0],
              0,
              secondLastSegment.position[2] - lastSegment.position[2]
            ];
            
            const tailLength = Math.sqrt(tailDir[0]**2 + tailDir[2]**2) || 0.001;
            
            // Normalize direction
            const normalizedTailDir = [
              tailDir[0] / tailLength,
              0,
              tailDir[2] / tailLength
            ];
            
            // Position new segment continuing the tail direction
            newPos = [
              lastSegment.position[0] - normalizedTailDir[0] * SNAKE_SEGMENT_SPACING * 0.8,
              SNAKE_ELEVATION,
              lastSegment.position[2] - normalizedTailDir[2] * SNAKE_SEGMENT_SPACING * 0.8
            ];
            
            // Match rotation of last segment
            newRot = [...lastSegment.rotation];
          }
          
          // Add the segment to the snake
          newSnake.push({
            position: newPos,
            rotation: newRot
          });
        }
      } else {
        // This is the very first move, create initial body segments
        const effectiveDirection = dirMagnitude > 0 ? 
          [dx, 0, dz] : // Use the current movement direction if moving
          direction.length ? direction : [0, 0, -1]; // Use stored direction or default backward
        
        // Create body segments in a line behind the head
        for (let i = 1; i < snakeLength; i++) {
          const headPos = newHead.position;
          const headRot = newHead.rotation;
          // Use a smaller spacing multiplier for tighter following
          const spacing = SNAKE_SEGMENT_SPACING * 0.8;
          
          const segmentPos = [
            headPos[0] - (effectiveDirection[0] * i * spacing),
            SNAKE_ELEVATION,
            headPos[2] - (effectiveDirection[2] * i * spacing)
          ];
          
          newSnake.push({
            position: segmentPos,
            rotation: [...headRot]
          });
        }
      }
      
      return newSnake;
    })
  }
  
  // Update score and check for growth thresholds
  const updateScoreAndFatness = (additionalScore) => {
    setScore(prevScore => {
      const newScore = prevScore + additionalScore;
      
      // Increase fatness with food consumption
      setSnakeFatness(prevFatness => {
        const newFatness = prevFatness + FATNESS_GROWTH_PER_FOOD;
        
        // Check if snake has reached maximum fatness
        if (newFatness >= MAX_SNAKE_FATNESS && !isExploding) {
          console.log(`Snake has reached maximum fatness (${newFatness.toFixed(2)})! EXPLODING!!!`);
          
          // Trigger the explosion
          explodeSnake();
        }
        
        return Math.min(newFatness, MAX_SNAKE_FATNESS);
      });
      
      // Add visual feedback for getting fatter
      const headPosition = snake[0]?.position || [0, 0, 0];
      for (let p = 0; p < 3; p++) {
        setTimeout(() => {
          setTrail(prev => [
            ...prev.slice(-MAX_PARTICLES + 1),
            {
              position: [...headPosition],
              color: selectedSnakeType?.color || '#ffffff',
              size: 0.3 + snakeFatness * 0.2,
              life: 15
            }
          ]);
        }, p * 100);
      }
      
      return newScore;
    });
  };
  
  // Add explodeSnake function
  const explodeSnake = () => {
    setIsExploding(true);
    
    // Create blood particles at snake segments
    const newBloodParticles = [];
    const bloodColors = ['#ff0000', '#cc0000', '#990000', '#880000', '#aa0000', '#dd0000'];
    
    // Play explosion sound more reliably
    if (explosionSoundRef.current) {
      // Reset the sound to the beginning in case it was already playing
      explosionSoundRef.current.currentTime = 0;
      
      // Play with both methods for better browser compatibility
      const playPromise = explosionSoundRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Sound play error:", error);
          
          // Try alternative method if initial play fails (for browsers with autoplay restrictions)
          const userInteraction = () => {
            explosionSoundRef.current.play().catch(e => console.log("Second attempt error:", e));
            document.removeEventListener('click', userInteraction);
            document.removeEventListener('keydown', userInteraction);
          };
          
          document.addEventListener('click', userInteraction, { once: true });
          document.addEventListener('keydown', userInteraction, { once: true });
        });
      }
    } else {
      // Fallback if the ref doesn't exist
      try {
        const backupSound = new Audio('/explosion.mp3');
        backupSound.volume = 0.8;
        backupSound.play().catch(e => console.log("Backup sound error:", e));
      } catch (err) {
        console.log("Sound error:", err);
      }
    }
    
    // Create many more blood particles at each snake segment
    snake.forEach(segment => {
      for (let i = 0; i < 50; i++) {
        const speed = 0.2 + Math.random() * 0.8;
        const direction = [
          (Math.random() - 0.5) * 2,
          Math.random() * 2, // More upward bias
          (Math.random() - 0.5) * 2
        ];
        
        // Normalize direction
        const length = Math.sqrt(direction[0]**2 + direction[1]**2 + direction[2]**2) || 1;
        
        newBloodParticles.push({
          position: [
            segment.position[0] + (Math.random() - 0.5) * 1 * snakeFatness,
            segment.position[1] + (Math.random() - 0.5) * 1 * snakeFatness,
            segment.position[2] + (Math.random() - 0.5) * 1 * snakeFatness
          ],
          velocity: [
            direction[0] / length * speed,
            direction[1] / length * speed,
            direction[2] / length * speed
          ],
          color: bloodColors[Math.floor(Math.random() * bloodColors.length)],
          size: 0.1 + Math.random() * 0.7 * snakeFatness,
          life: 40 + Math.random() * 120,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          rotation: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2]
        });
      }
      
      // Add some chunks of snake meat
      for (let i = 0; i < 10; i++) {
        const speed = 0.1 + Math.random() * 0.6;
        const direction = [
          (Math.random() - 0.5) * 2,
          Math.random() * 1.5, // More upward bias
          (Math.random() - 0.5) * 2
        ];
        
        // Normalize direction
        const length = Math.sqrt(direction[0]**2 + direction[1]**2 + direction[2]**2) || 1;
        
        newBloodParticles.push({
          position: [
            segment.position[0],
            segment.position[1],
            segment.position[2]
          ],
          velocity: [
            direction[0] / length * speed,
            direction[1] / length * speed,
            direction[2] / length * speed
          ],
          color: selectedSnakeType?.color || "#44aa44",
          size: 0.3 + Math.random() * 0.6 * snakeFatness,
          life: 120 + Math.random() * 100,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          rotation: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2],
          isChunk: true
        });
      }
    });
    
    setBloodParticles(newBloodParticles);
    
    // Add screen shake
    setScreenShake(0.5);
    
    // Create explosion light
    setExplosionLight(true);
    setExplosionIntensity(5.0);
    
    // Reset snake after a delay
    setTimeout(() => {
      resetWorld();
      setIsExploding(false);
      setBloodParticles([]);
      setSnakeFatness(INITIAL_SNAKE_FATNESS);
      setExplosionLight(false);
    }, 5000);
  };
  
  // Optimized game loop with fixed isometric camera 
  useFrame((state, delta) => {
    if (snake.length === 0) return
    
    const head = snake[0]
    const frameTime = delta * 1000 // convert to ms
    
    // Update powerups countdown
    setPowerups(prev => {
      const updated = { ...prev }
      let changed = false
      
      // Update each powerup timer
      Object.keys(updated).forEach(key => {
        if (updated[key].active) {
          updated[key].timeLeft -= delta
          changed = true
          
          // Deactivate if time ran out
          if (updated[key].timeLeft <= 0) {
            updated[key].active = false
            updated[key].timeLeft = 0
          }
        }
      })
      
      return changed ? updated : prev
    })
    
    // Update trail particles
    setTrail(prev => {
      if (prev.length === 0) return prev
      
      return prev
        .map(particle => ({
          ...particle,
          life: particle.life - 1,
          size: particle.size * 0.97 // Particles gradually shrink
        }))
        .filter(particle => particle.life > 0)
    })
    
    // Occasionally add glow trail for better visibility
    if (powerups && powerups.speed && powerups.speed.active && Math.random() > 0.6) {
      // Add speed trail
      setTrail(prev => [
        ...prev,
        {
          position: [...head.position],
          color: '#88ffff',
          size: 0.4 + Math.random() * 0.2,
          life: 15
        }
      ])
    }
    
    if (powerups && powerups.invincible && powerups.invincible.active && Math.random() > 0.7) {
      // Add invincibility aura
      const angle = Math.random() * Math.PI * 2
      const radius = 1.5 + Math.random()
      setTrail(prev => [
        ...prev,
        {
          position: [
            head.position[0] + Math.cos(angle) * radius,
            head.position[1],
            head.position[2] + Math.sin(angle) * radius
          ],
          color: '#ffdd00',
          size: 0.3 + Math.random() * 0.3,
          life: 20
        }
      ])
    }
    
    if (powerups && powerups.magnet && powerups.magnet.active && Math.random() > 0.8) {
      // Add magnet aura
      const angle = Math.random() * Math.PI * 2
      const radius = 2 + Math.random() * 2
      setTrail(prev => [
        ...prev,
        {
          position: [
            head.position[0] + Math.cos(angle) * radius,
            head.position[1],
            head.position[2] + Math.sin(angle) * radius
          ],
          color: '#44ff44',
          size: 0.2 + Math.random() * 0.2,
          life: 10
        }
      ])
    }
    
    // Optimized performance: only update AI snakes if they're within a certain distance of the player
    if (aiSnakes.length > 0) {
      setAiSnakes(prevAiSnakes => {
        return prevAiSnakes.map(aiSnake => {
          // Performance optimization - only update AI snakes that are close to the player
          const headPos = aiSnake.segments[0].position
          const distToPlayer = Math.sqrt(
            Math.pow(head.position[0] - headPos[0], 2) +
            Math.pow(head.position[2] - headPos[2], 2)
          )
          
          // Skip updates for distant snakes
          if (distToPlayer > MAX_VISIBLE_DISTANCE) return aiSnake
          
          // Accumulate time since last update
          aiSnake.lastUpdate = (aiSnake.lastUpdate || 0) + delta
          
          // Update rate varies by behavior - faster for more responsive gameplay
          const updateRate = aiSnake.behavior === 'wanderer' ? 0.05 : 
                           aiSnake.behavior === 'follower' ? 0.06 : 0.08
          
          if (aiSnake.lastUpdate < updateRate) return aiSnake
          
          // Reset update timer
          aiSnake.lastUpdate = 0
          
          // Get current direction
          let [dx, dy, dz] = aiSnake.direction
          
          // Keep AI snakes on the board
          const boardRadius = GRID_SIZE / 2 * VOXEL_SIZE * 0.9
          const distFromCenter = Math.sqrt(
            Math.pow(headPos[0], 2) + 
            Math.pow(headPos[2], 2)
          )
          
          // If approaching edge, steer back toward center
          if (distFromCenter > boardRadius * 0.8) {
            const toCenter = [
              -headPos[0] / distFromCenter,
              0,
              -headPos[2] / distFromCenter
            ]
            
            // Gradually blend with current direction
            const blendFactor = (distFromCenter - boardRadius * 0.8) / (boardRadius * 0.2)
            dx = dx * (1 - blendFactor) + toCenter[0] * blendFactor
            dz = dz * (1 - blendFactor) + toCenter[2] * blendFactor
            
            // Normalize
            const mag = Math.sqrt(dx*dx + dz*dz)
            if (mag > 0) {
              dx /= mag
              dz /= mag
            }
          }
          
          // Update direction based on behavior
          switch(aiSnake.behavior) {
            case 'follower':
              // Try to follow player at a distance
              const toPlayer = [
                head.position[0] - headPos[0],
                0, // Keep on the same y-level in isometric mode
                head.position[2] - headPos[2]
              ]
              const dist = Math.sqrt(toPlayer[0]**2 + toPlayer[2]**2)
              
              if (dist > 0) {
                // Keep optimal distance
                if (dist > 15) { // Too far, move closer
                  dx = toPlayer[0] / dist
                  dz = toPlayer[2] / dist
                } else if (dist < 8) { // Too close, back away
                  dx = -toPlayer[0] / dist
                  dz = -toPlayer[2] / dist
                } else { // Orbit around at ideal distance
                  dx = -toPlayer[2] / dist // Perpendicular to player direction
                  dz = toPlayer[0] / dist
                }
              }
              break
              
            case 'digger':
              // In isometric mode, diggers become faster movers that change direction frequently
              if (Math.random() < 0.1) {
                dx = (Math.random() - 0.5) * 2
                dz = (Math.random() - 0.5) * 2
                
                // Normalize
                const mag = Math.sqrt(dx*dx + dz*dz)
                if (mag > 0) {
                  dx /= mag
                  dz /= mag
                }
              }
              
              // Sometimes make sudden direction changes for evasive behavior
              if (Math.random() < 0.02) {
                dx = -dx + (Math.random() - 0.5) * 0.5
                dz = -dz + (Math.random() - 0.5) * 0.5
              }
              break
            
            case 'wanderer':
            default:
              // Random wandering behavior with smoother turns
              if (Math.random() < 0.05) {
                // Gradual direction change
                const turnAmount = 0.3
                const angle = Math.atan2(dx, dz) + (Math.random() - 0.5) * turnAmount
                dx = Math.sin(angle)
                dz = Math.cos(angle)
              }
              
              // Occasionally make bigger direction changes
              if (Math.random() < 0.01) {
                dx = (Math.random() - 0.5) * 2
                dz = (Math.random() - 0.5) * 2
                
                // Normalize
                const mag = Math.sqrt(dx*dx + dz*dz)
                if (mag > 0) {
                  dx /= mag
                  dz /= mag
                }
              }
              break
          }
          
          // Create new snake segments starting with new head
          const newSegments = []
          const oldHead = aiSnake.segments[0]
          
          // Movement amount varies by snake behavior
          const moveSpeed = aiSnake.behavior === 'wanderer' ? 0.3 : 
                          aiSnake.behavior === 'digger' ? 0.45 : 0.25
          
          // Slower movement and elevated position to prevent terrain clipping
          const newHeadPos = [
            oldHead.position[0] + dx * moveSpeed * AI_SNAKE_SPEED_MULTIPLIER,
            SNAKE_ELEVATION, // Keep snake elevated above terrain
            oldHead.position[2] + dz * moveSpeed * AI_SNAKE_SPEED_MULTIPLIER
          ]
          
          // Calculate new rotation
          const newHeadRot = [
            0, // No pitch in isometric view
            Math.atan2(dx, dz),
            0
          ]
          
          // Add new head
          newSegments.push({
            position: newHeadPos,
            rotation: newHeadRot
          })
          
          // Improved segment following - smoother for fast movement
          for (let i = 0; i < aiSnake.segments.length - 1; i++) {
            const segment = aiSnake.segments[i]
            
            // Follow factor based on segment index - head follows more closely
            const followFactor = 0.5 - i * 0.02 // Decrease follow factor for tail segments
            
            const nextPos = [
              segment.position[0] * (1 - followFactor) + newSegments[i].position[0] * followFactor,
              SNAKE_ELEVATION, // Keep elevated above terrain to prevent clipping
              segment.position[2] * (1 - followFactor) + newSegments[i].position[2] * followFactor
            ]
            
            newSegments.push({
              position: nextPos,
              rotation: [
                0, // No pitch in isometric
                Math.atan2(
                  nextPos[0] - segment.position[0],
                  nextPos[2] - segment.position[2]
                ),
                0
              ]
            })
          }
          
          // Add trail particles for AI snakes too (but less frequently)
          if (Math.random() > 0.95) {
            setTrail(prev => [
              ...prev,
              {
                position: [...headPos],
                color: aiSnake.type.trailColor || aiSnake.type.color,
                size: 0.2 + Math.random() * 0.2,
                life: 10
              }
            ])
          }
          
          return {
            ...aiSnake,
            segments: newSegments,
            direction: [dx, 0, dz] // Keep y at 0 for isometric
          }
        })
      })
    }
    
    // Report game state to parent component for HUD elements
    if (onGameStateUpdate && head?.position) {
      // Calculate rotation angle for minimap direction indicator
      const dirAngle = Math.atan2(direction[0], direction[2])
      onGameStateUpdate(head.position, terrain, dirAngle, { 
        snakeLength, 
        powerups,
        snakeFatness,
        maxFatness: MAX_SNAKE_FATNESS
      })
    }
    
    // Always use isometric view
    // Optimized fixed-angle isometric camera
    const targetPosition = new THREE.Vector3(
      head.position[0] + CAMERA_OFFSET[0],
      head.position[1] + CAMERA_OFFSET[1],
      head.position[2] + CAMERA_OFFSET[2]
    )
    
    // Look at player with slight offset
    const lookAtPosition = new THREE.Vector3(
      head.position[0] + CAMERA_TARGET_OFFSET[0],
      head.position[1] + CAMERA_TARGET_OFFSET[1],
      head.position[2] + CAMERA_TARGET_OFFSET[2]
    )
    
    // Smooth camera movement 
    camera.position.lerp(targetPosition, SMOOTH_FACTOR)
    camera.lookAt(lookAtPosition)
    
    setMoveCounter(prev => (prev + 1) % 1000); // Increment move counter and wrap around at 1000
    
    // Handle screen shake
    if (screenShake > 0) {
      // Use the camera from the state parameter
      const { camera } = state;
      
      // Apply random shake to camera
      camera.position.x += (Math.random() - 0.5) * screenShake;
      camera.position.y += (Math.random() - 0.5) * screenShake;
      camera.position.z += (Math.random() - 0.5) * screenShake;
      
      // Reduce shake over time
      setScreenShake(prev => Math.max(0, prev - delta * 0.5));
    }
    
    // Reduce explosion light intensity
    if (explosionLight) {
      setExplosionIntensity(prev => Math.max(0, prev - delta * 2.0));
    }
    
    // Update blood particles for explosion
    if (isExploding) {
      setBloodParticles(prev => {
        if (prev.length === 0) return prev;
        
        return prev
          .map(particle => ({
            ...particle,
            position: [
              particle.position[0] + particle.velocity[0],
              particle.position[1] + particle.velocity[1] - 0.03, // Gravity
              particle.position[2] + particle.velocity[2]
            ],
            velocity: [
              particle.velocity[0] * 0.98,
              particle.velocity[1] * 0.98,
              particle.velocity[2] * 0.98
            ],
            life: particle.life - 1,
            size: particle.size * 0.995,
            rotation: particle.rotation ? [
              particle.rotation[0] + particle.rotationSpeed || 0,
              particle.rotation[1] + particle.rotationSpeed || 0,
              particle.rotation[2] + particle.rotationSpeed || 0
            ] : [0, 0, 0]
          }))
          .filter(particle => particle.life > 0);
      });
    }
  })
  
  // Move frame counter ref to the component level to fix the hook error
  const frameCounter = useRef(0);
  
  // Create a shared voxel geometry at component level
  const sharedVoxelGeometry = useMemo(() => 
    new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE), []);
  
  // Ultra-optimized voxel rendering for maximum FPS
  const renderVoxels = () => {
    if (snake.length === 0) return null
    
    const [sx, sy, sz] = snake[0].position
    const renderDistance = 12 // Further reduced render distance
    
    // Performance optimization: limit how often full terrain is processed
    frameCounter.current = (frameCounter.current + 1) % 4 // Only process every 4th frame
    
    // Early culling of voxels with fast square distance check (avoiding sqrt for performance)
    const maxDistanceSquared = renderDistance * renderDistance * VOXEL_SIZE * VOXEL_SIZE
    
    // Process only if it's a frame we want to process, otherwise use cached results
    if (frameCounter.current === 0 || !renderVoxels.cachedVoxels) {
      // Create a simpler, faster version of terrain processing
      const entries = Object.entries(terrain);
      
      // Pre-allocate array of sufficient size to avoid resizing
      const closestVoxels = new Array(Math.min(entries.length, MAX_VOXELS * 3));
      let voxelCount = 0;
      
      // First-pass culling - very fast approximate distance check
      for (let i = 0; i < entries.length && voxelCount < MAX_VOXELS * 3; i++) {
        const [key, voxel] = entries[i];
        const [vx, vy, vz] = voxel.position;
        
        // Fast square distance (no sqrt)
        const distSquared = 
          (vx - sx) * (vx - sx) + 
          (vy - sy) * (vy - sy) + 
          (vz - sz) * (vz - sz);
          
        if (distSquared < maxDistanceSquared) {
          closestVoxels[voxelCount++] = {
            key,
            voxel,
            distSquared // Store squared distance for faster sorting
          };
        }
      }
      
      // Only sort the voxels we actually found
      const actualVoxels = closestVoxels.slice(0, voxelCount);
      
      // Sort by squared distance (faster than using sqrt)
      actualVoxels.sort((a, b) => a.distSquared - b.distSquared);
      
      // Take only what we need for rendering
      renderVoxels.cachedVoxels = actualVoxels.slice(0, MAX_VOXELS);
    }
    
    // Create an array of TerrainVoxel components
    return renderVoxels.cachedVoxels.map(({ key, voxel }) => (
      <TerrainVoxel
        key={key}
        position={voxel.position}
        size={VOXEL_SIZE}
        color={voxel.color}
        geometry={sharedVoxelGeometry} // Use the component-level shared geometry
      />
    ));
  }
  
  // Preload explosion sound
  
  // Add the useEffect for preloading the sound
  useEffect(() => {
    // Preload the explosion sound
    explosionSoundRef.current = new Audio('/explosion.mp3');
    explosionSoundRef.current.volume = 0.8;
    explosionSoundRef.current.load();
    
    return () => {
      // Clean up audio resources
      if (explosionSoundRef.current) {
        explosionSoundRef.current.pause();
        explosionSoundRef.current = null;
      }
    };
  }, []);
  
  return (
    <>
      {/* Use IsometricControlsWrapper for isometric view */}
      <IsometricControlsWrapper 
        enabled={true}
        onMove={moveSnake}
      />
      
      {/* Add soft ambient lighting for better visibility */}
      <ambientLight intensity={0.8} color="#f5f5f5" />
      
      {/* Dynamic sky color based on depth */}
      {snake.length > 0 && snake[0].position[1] < -10 ? (
        <color attach="background" args={['#111']} />
      ) : (
        <Sky distance={450000} sunPosition={[0, 1, 0]} />
      )}
      
      {/* Add stars when we're underground */}
      {snake.length > 0 && snake[0].position[1] < -5 && (
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
      )}
      
      {/* Ambient light */}
      <ambientLight intensity={snake.length > 0 && snake[0].position[1] < -10 ? 0.4 : 0.7} /> {/* Increased ambient light */}
      
      {/* Directional light (sun) */}
      <directionalLight 
        position={[50, 50, 50]} 
        intensity={snake.length > 0 && snake[0].position[1] < -5 ? 0.3 : 1.2} /* Brighter light */
        castShadow 
      />
      
      {/* Additional spotlight to ensure snake is always visible */}
      {snake.length > 0 && (
        <spotLight
          position={[
            snake[0].position[0],
            snake[0].position[1] + 15, // High above the snake
            snake[0].position[2]
          ]}
          angle={0.6}
          penumbra={0.5}
          intensity={0.8}
          distance={25}
          castShadow
          color={'#ffffff'}
          target-position={[
            snake[0].position[0],
            snake[0].position[1],
            snake[0].position[2]
          ]}
        />
      )}
      
      {/* Snake head lamp when underground or when any powerup is active */}
      {snake.length > 0 && (snake[0].position[1] < -5 || 
                          (powerups && powerups.speed && powerups.speed.active) || 
                          (powerups && powerups.invincible && powerups.invincible.active) || 
                          (powerups && powerups.magnet && powerups.magnet.active)) && (
        <spotLight
          position={[
            snake[0].position[0],
            snake[0].position[1] + 0.5,
            snake[0].position[2]
          ]}
          angle={0.5}
          penumbra={0.5}
          intensity={(powerups && powerups.invincible && powerups.invincible.active) ? 2.5 : 2}
          distance={(powerups && powerups.speed && powerups.speed.active) ? 20 : 15}
          castShadow
          color={(powerups && powerups.speed && powerups.speed.active) ? '#88ffff' : 
                (powerups && powerups.invincible && powerups.invincible.active) ? '#ffdd00' : 
                (powerups && powerups.magnet && powerups.magnet.active) ? '#44ff44' : '#ffffff'}
          target-position={[
            snake[0].position[0] + direction[0] * 5,
            snake[0].position[1] + direction[1] * 5,
            snake[0].position[2] + direction[2] * 5
          ]}
        />
      )}
      
      {/* Ground surface */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#3a7d44" />
      </mesh>
      
      {/* Render terrain voxels */}
      {renderVoxels()}
      
      {/* Optimized particle trail effects for better performance */}
      <group>
        {/* Create a single shared geometry for all trail particles */}
        {(() => {
          // Pre-compute shared geometries and materials at render time (not during component render)
          const trailGeometry = new THREE.SphereGeometry(1, 6, 6);
          
          // Only render a limited number of particles
          const visibleParticles = trail
            .slice(-25) // Limit to 25 particles maximum
            // Skip particles to reduce count when there are many
            .filter((_, index) => trail.length < 15 || index % 2 === 0);
          
          return visibleParticles.map((particle, i) => (
            <mesh 
              key={`trail-${i}`}
              position={particle.position}
              scale={particle.size}
            >
              <primitive object={trailGeometry} attach="geometry" />
              <meshStandardMaterial 
                color={particle.color}
                emissive={particle.color}
                emissiveIntensity={0.8}
                transparent={true}
                opacity={Math.min(1, particle.life / 20)} // Fade out as life decreases
              />
            </mesh>
          ));
        })()}
      </group>
      
      {/* Render collectibles */}
      <group>
        {collectibles.map(collectible => (
          <Collectible
            key={collectible.id}
            item={collectible.item}
            position={collectible.position}
            onCollect={() => {
              // Find the collectible index
              const index = collectibles.findIndex(c => c.id === collectible.id)
              if (index !== -1) {
                // Update inventory - check for duplicates first
                console.log('WorldManager: Adding to inventory:', collectible.item.name)
                setInventory(prev => {
                  // Check if an identical item already exists in the inventory
                  const isDuplicate = prev.some(existingItem => 
                    existingItem.name === collectible.item.name && 
                    existingItem.type === collectible.item.type
                  );
                  
                  // Only add if not a duplicate
                  if (!isDuplicate) {
                    return [...prev, collectible.item];
                  } else {
                    console.log('WorldManager: Prevented duplicate item:', collectible.item.name);
                    return prev;
                  }
                });
                
                // Update score
                const itemValue = collectible.item.value * 10
                setScore(prev => prev + itemValue)
                
                // Handle growth for food items
                if (collectible.item.type === 'food') {
                  const growthAmount = collectible.item.growthAmount || 1
                  setSnakeLength(prev => Math.min(MAX_SNAKE_LENGTH, prev + growthAmount))
                }
                
                // Handle powerup items
                if (collectible.item.type === 'powerup') {
                  setPowerups(prev => ({
                    ...prev,
                    [collectible.item.effect]: {
                      active: true,
                      timeLeft: collectible.item.duration || 10
                    }
                  }))
                }
                
                // Remove collectible
                setCollectibles(prev => prev.filter((_, i) => i !== index))
                
                // Call collect callback - pass the item value rather than the new total score
                onTreasureCollect(collectible.item, itemValue)
              }
            }}
          />
        ))}
      </group>
      
      {/* Render player snake with digging effect and player indicator */}
      <group>
        {/* Player indicator arrow above the snake head */}
        {snake.length > 0 && (
          <group position={[
            snake[0].position[0], 
            snake[0].position[1] + 3.5, // Higher position for better visibility
            snake[0].position[2]
          ]}>
            {/* Large arrow pointing down */}
            <mesh>
              <coneGeometry args={[1.0, 2.0, 8]} /> {/* Larger arrow */}
              <meshStandardMaterial 
                color={powerups && powerups.invincible && powerups.invincible.active ? '#ffcc00' : 
                      powerups && powerups.speed && powerups.speed.active ? '#00ccff' : 
                      powerups && powerups.magnet && powerups.magnet.active ? '#33dd33' : '#ffff00'} 
                emissive={powerups && powerups.invincible && powerups.invincible.active ? '#ffaa00' : 
                         powerups && powerups.speed && powerups.speed.active ? '#00aaff' : 
                         powerups && powerups.magnet && powerups.magnet.active ? '#22aa22' : '#ff9900'} 
                emissiveIntensity={1.0} // Brighter glow
              />
            </mesh>
            
            {/* Add a light source to make the indicator more visible */}
            <pointLight 
              intensity={0.8}
              distance={8}
              color="#ffffff"
            />
            
            {/* "YOU" text with powerup info */}
            <Text
              position={[0, 1.5, 0]}
              fontSize={1}
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.1}
              outlineColor="#000000"
            >
              YOU
            </Text>
            
            {/* Show active powerup text */}
            {powerups && (
              (powerups.speed && powerups.speed.active) || 
              (powerups.invincible && powerups.invincible.active) || 
              (powerups.magnet && powerups.magnet.active)
            ) && (
              <Text
                position={[0, 2.3, 0]}
                fontSize={0.6}
                color={(powerups.invincible && powerups.invincible.active) ? '#ffdd00' : 
                      (powerups.speed && powerups.speed.active) ? '#88ffff' : 
                      (powerups.magnet && powerups.magnet.active) ? '#aaffaa' : 'white'}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.06}
                outlineColor="#000000"
              >
                {(powerups.invincible && powerups.invincible.active) ? 'INVINCIBLE!' : 
                 (powerups.speed && powerups.speed.active) ? 'SPEED BOOST!' : 
                 (powerups.magnet && powerups.magnet.active) ? 'MAGNET ACTIVE!' : ''}
              </Text>
            )}
            
            {/* Show current snake length */}
            <Text
              position={[0, 0.7, 0]}
              fontSize={0.5}
              color={snakeFatness > MAX_SNAKE_FATNESS * 0.8 ? "#ff5555" : "#aaffaa"}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#000000"
            >
              {`FATNESS: ${Math.floor(snakeFatness * 100) / 100}/${MAX_SNAKE_FATNESS}`}
            </Text>
          </group>
        )}
        
        {/* Power-up effect ring around player head when any powerup is active */}
        {snake.length > 0 && powerups && (
          (powerups.speed && powerups.speed.active) || 
          (powerups.invincible && powerups.invincible.active) || 
          (powerups.magnet && powerups.magnet.active)
        ) && (
          <group position={[snake[0].position[0], snake[0].position[1], snake[0].position[2]]}>
            <mesh rotation={[Math.PI/2, 0, 0]}>
              <ringGeometry args={[1.5, 1.7, 32]} />
              <meshStandardMaterial 
                color={(powerups.invincible && powerups.invincible.active) ? '#ffcc00' : 
                      (powerups.speed && powerups.speed.active) ? '#00ccff' : 
                      (powerups.magnet && powerups.magnet.active) ? '#33dd33' : '#ffffff'} 
                emissive={(powerups.invincible && powerups.invincible.active) ? '#ffaa00' : 
                         (powerups.speed && powerups.speed.active) ? '#00aaff' : 
                         (powerups.magnet && powerups.magnet.active) ? '#22aa22' : '#ffffff'}
                emissiveIntensity={0.8}
                transparent={true}
                opacity={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )}
        
        {/* Render player snake segments with fatness instead of length */}
        {!isExploding && snake.map((segment, index) => {
          // Add digging effect to the head when moving vertically (up/down)
          const isDigging = index === 0 && Math.abs(direction[1]) > 0
          
          // Add powerup effects to all segments
          const hasPowerup = powerups && (
            (powerups.speed && powerups.speed.active) || 
            (powerups.invincible && powerups.invincible.active) || 
            (powerups.magnet && powerups.magnet.active)
          )
          
          return (
            <SnakeSegment
              key={`player-${index}`}
              position={segment.position}
              rotation={segment.rotation}
              isHead={index === 0}
              type={snakeTypeRef.current}
              // Use snakeFatness for scaling all segments
              // Apply fatness to all segments, with the head slightly larger
              scale={snakeFatness * (1 + (index === 0 ? 0.3 : 0))}
              // Apply a gentler taper for better visibility of all segments
              // Make sure even the tail segments are substantial enough to see
              scaleFactor={Math.max(0.9, 1 - (index / Math.max(snake.length, INITIAL_SNAKE_LENGTH) * 0.1))}
              // No digging glow effect
              isDigging={false} 
              segmentIndex={index}
              totalSegments={snake.length}
            />
          )
        })}
        
        {/* Digging particle effect */}
        {snake.length > 0 && Math.abs(direction[1]) > 0 && (
          <group position={[
            snake[0].position[0] + direction[0], 
            snake[0].position[1] + direction[1] * 1.5, 
            snake[0].position[2] + direction[2]
          ]}>
            {[...Array(6)].map((_, i) => (
              <mesh key={i} position={[
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
              ]}>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshStandardMaterial 
                  color={direction[1] < 0 ? '#8d6e63' : '#aaa'} 
                  emissive={direction[1] < 0 ? '#5d4037' : '#777'}
                />
              </mesh>
            ))}
          </group>
        )}
      </group>
      
      {/* Render AI snakes */}
      {aiSnakes.map((aiSnake, snakeIndex) => (
        <group key={`ai-snake-${snakeIndex}`}>
          {aiSnake.segments.map((segment, segmentIndex) => {
            // AI snakes can dig too - make digger snake types glow when moving vertically
            const isDigging = aiSnake.behavior === 'digger' && 
                            segmentIndex === 0 && 
                            Math.abs(aiSnake.direction[1]) > 0.3
            
            return (
              <SnakeSegment
                key={`ai-${snakeIndex}-${segmentIndex}`}
                position={segment.position}
                rotation={segment.rotation}
                isHead={segmentIndex === 0}
                type={aiSnake.type}
                scale={0.9 + (segmentIndex === 0 ? 0.2 : 0)} // Slightly smaller than player
                isDigging={isDigging}
                segmentIndex={segmentIndex}
                totalSegments={aiSnake.segments.length}
                isAI={true}
              />
            )
          })}
          
          {/* Name label above AI snake */}
          <group position={[
            aiSnake.segments[0].position[0],
            aiSnake.segments[0].position[1] + 1.5,
            aiSnake.segments[0].position[2]
          ]}>
            <Text
              position={[0, 0, 0]}
              rotation={[0, 0, 0]}
              fontSize={0.7} // Larger text for better visibility
              color={aiSnake.type.color}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="black"
              renderOrder={1}
            >
              {aiSnake.type.name}
            </Text>
            <Text
              position={[0, -0.6, 0]}
              rotation={[0, 0, 0]}
              fontSize={0.4}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.04}
              outlineColor="black"
              renderOrder={1}
            >
              {aiSnake.behavior === 'wanderer' ? 'Wanderer' : 
               aiSnake.behavior === 'digger' ? 'Digger' : 
               aiSnake.behavior === 'follower' ? 'Follower' : ''}
            </Text>
          </group>
        </group>
      ))}
      
      {/* Render blood explosion particles */}
      {isExploding && bloodParticles.map((particle, index) => (
        particle.isChunk ? (
          <mesh 
            key={`chunk-${index}`} 
            position={particle.position}
            rotation={particle.rotation}
          >
            <octahedronGeometry args={[particle.size, 1]} />
            <meshStandardMaterial 
              color={particle.color} 
              emissive={particle.color}
              emissiveIntensity={0.2}
              roughness={0.8}
            />
          </mesh>
        ) : (
          <mesh 
            key={`blood-${index}`} 
            position={particle.position}
            rotation={particle.rotation}
          >
            <sphereGeometry args={[particle.size, 8, 8]} />
            <meshStandardMaterial 
              color={particle.color} 
              emissive={particle.color}
              emissiveIntensity={0.3}
              roughness={0.3}
            />
          </mesh>
        )
      ))}
      
      {/* Explosion light */}
      {explosionLight && (
        <pointLight
          position={snake[0]?.position || [0, 0, 0]}
          distance={50}
          intensity={explosionIntensity}
          color="#ff3300"
        />
      )}
      
      {/* No HUD elements rendered inside canvas */}
    </>
  )
}

// Snake selection UI
function SnakeSelector({ onSelect }) {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '80%',
      maxWidth: '800px',
      padding: '25px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      borderRadius: '15px',
      color: 'white',
      fontFamily: 'monospace',
      zIndex: 100,
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 30px rgba(80, 200, 80, 0.3)',
      border: '1px solid rgba(100, 200, 100, 0.4)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <h1 style={{ 
          margin: '0 0 10px',
          fontSize: '32px',
          background: 'linear-gradient(45deg, #4CAF50, #2196F3, #9C27B0)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
            Voluminous Voxel Viper
        </h1>
        <h2 style={{ 
          margin: '0 0 5px', 
          fontSize: '22px',
          color: '#f0f0f0'
        }}>
          Select Your Viper
        </h2>
        <div style={{ fontSize: '14px', color: '#aaa', maxWidth: '500px', margin: '0 auto' }}>
          Choose wisely - each viper has unique abilities that affect gameplay
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '20px'
      }}>
        {SNAKE_TYPES.map(snake => (
          <div
            key={snake.name}
            style={{
              width: '220px',
              padding: '15px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'transform 0.2s, background-color 0.2s',
              border: `2px solid ${snake.color}`,
              textAlign: 'center'
            }}
            onClick={() => onSelect(snake)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
            }}
          >
            <div style={{ 
              height: '30px', 
              width: '100%', 
              backgroundColor: snake.color,
              borderRadius: '4px',
              marginBottom: '10px'
            }}></div>
            
            <h3 style={{ margin: '0 0 10px', color: snake.color }}>{snake.name}</h3>
            
            <div style={{ fontSize: '12px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Speed:</span>
                <span>{renderStatBars(snake.speed / 0.16 * 5)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Dig Power:</span>
                <span>{renderStatBars(snake.digPower / 2.0 * 5)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Strength:</span>
                <span>{renderStatBars(snake.strength / 1.5 * 5)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '14px', textAlign: 'center' }}>
        <p>Choose your snake carefully. Each snake has unique abilities that affect gameplay.</p>
      </div>
    </div>
  )
}

// Helper to render stat bars
function renderStatBars(value) {
  const fullBars = Math.floor(value)
  const bars = []
  
  for (let i = 0; i < 5; i++) {
    if (i < fullBars) {
      bars.push('■')
    } else {
      bars.push('□')
    }
  }
  
  return bars.join('')
}

// Treasure notification component
function TreasureNotification({ item, visible, onClose }) {
  const [pulseIntensity, setPulseIntensity] = useState(20)
  
  // Create pulse animation with useState and useEffect
  useEffect(() => {
    if (!visible) return
    
    let direction = 1
    const interval = setInterval(() => {
      setPulseIntensity(prev => {
        // Change direction when reaching limits
        if (prev >= 30) direction = -1
        if (prev <= 15) direction = 1
        return prev + direction
      })
    }, 50)
    
    // Auto-close notification after 5 seconds
    const closeTimer = setTimeout(() => {
      onClose();
    }, 5000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(closeTimer);
    }
  }, [visible, onClose])
  
  if (!visible) return null
  
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '240px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      padding: '8px 15px',
      borderRadius: '20px',
      border: `2px solid ${item.color}`,
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 100,
      boxShadow: `0 0 ${pulseIntensity}px ${item.color}`,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '2px',
        justifyContent: 'center',
      }}>
        <div style={{ 
          height: '16px',
          width: '16px',
          backgroundColor: item.color,
          borderRadius: '50%',
          marginRight: '8px',
          boxShadow: `0 0 5px ${item.color}`,
        }}></div>
        <div style={{ 
          fontWeight: 'bold',
          fontSize: '14px',
          color: item.color,
          textShadow: '0 0 5px rgba(0,0,0,0.8)'
        }}>{item.name}</div>
      </div>
      
      <div style={{ 
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
        margin: '5px 0',
        width: '100%'
      }}>
        <div style={{color: '#aaa'}}>Rarity: <span style={{color: 'white'}}>{item.rarity}</span></div>
        <div style={{color: '#aaa'}}>Value: <span style={{color: '#4eff4e'}}>+{item.value * 10}</span></div>
      </div>
    </div>
  )
}

// Mini-map component
function MiniMap({ snakePosition, terrain, viewMode }) {
  const mapSize = 120
  const mapScale = 1.5
  
  // Only update mini-map occasionally for performance
  const [mapTerrain, setMapTerrain] = useState([])
  const [centerPos, setCenterPos] = useState([0, 0])
  const updateCounterRef = useRef(0)
  
  useEffect(() => {
    if (!snakePosition) return
    
    // Only update map every few frames
    updateCounterRef.current++
    if (updateCounterRef.current % 10 !== 0) return
    
    const [x, y, z] = snakePosition
    setCenterPos([x, z])
    
    // Collect terrain data for mini-map
    const terrainPoints = []
    const mapRadius = mapSize / mapScale / 2
    
    // Simplify terrain data for mini-map
    Object.entries(terrain).forEach(([key, voxel]) => {
      const [vx, vy, vz] = voxel.position
      
      // Skip if too far away
      if (Math.abs(vx - x) > mapRadius || Math.abs(vz - z) > mapRadius) {
        return
      }
      
      // Only show top-most block at each x,z position
      terrainPoints.push({
        x: vx,
        y: vy,
        z: vz,
        color: voxel.color,
        depth: voxel.depth
      })
    })
    
    setMapTerrain(terrainPoints)
  }, [snakePosition, terrain])
  
  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      right: 10,
      width: `${mapSize}px`,
      height: `${mapSize}px`,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderRadius: '50%',
      overflow: 'hidden',
      border: '2px solid rgba(255, 255, 255, 0.5)',
      boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}>
        {/* Map terrain dots */}
        {mapTerrain.map((point, index) => {
          const mapX = (point.x - centerPos[0]) * mapScale + mapSize/2
          const mapZ = (point.z - centerPos[1]) * mapScale + mapSize/2
          
          // Skip if outside of map bounds
          if (mapX < 0 || mapX > mapSize || mapZ < 0 || mapZ > mapSize) {
            return null
          }
          
          // Make deeper blocks smaller
          const dotSize = Math.max(2, 5 - point.depth / 10)
          
          return (
            <div 
              key={index}
              style={{
                position: 'absolute',
                left: `${mapX}px`,
                top: `${mapZ}px`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                backgroundColor: point.color,
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            />
          )
        })}
        
        {/* Snake position marker */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '8px',
          height: '8px',
          backgroundColor: '#ffffff',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
          zIndex: 10
        }} />
        
        {/* Direction indicator */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '0',
          height: '0',
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderBottom: '12px solid rgba(255, 255, 255, 0.8)',
          transform: `translate(-50%, -50%) rotate(${snakePosition?.[3] || 0}rad)`,
          transformOrigin: 'center calc(100% - 4px)',
          zIndex: 5
        }} />
      </div>
    </div>
  )
}

// Main HUD component
function HUD({ score, inventory, depth, layer, viewMode, snakePosition, terrain, gameInfo }) {
  // Extract additional game info if provided
  const snakeLength = gameInfo?.snakeLength || 0
  const powerups = gameInfo?.powerups || {}
  
  // Create a count of items by type and name
  const itemCounts = useMemo(() => {
    const counts = {};
    
    inventory.forEach(item => {
      // Group by type first
      if (!counts[item.type]) {
        counts[item.type] = { 
          total: 0, 
          items: {} 
        };
      }
      
      // Then by item name
      if (!counts[item.type].items[item.name]) {
        counts[item.type].items[item.name] = {
          count: 0,
          color: item.color,
          value: item.value,
          enhanced: item.enhanced || 0
        };
      }
      
      // Update counts
      counts[item.type].items[item.name].count += (item.count || 1);
      counts[item.type].total += (item.count || 1);
    });
    
    return counts;
  }, [inventory]);
  
  // Add debug log for inventory updates
  useEffect(() => {
    console.log('HUD: Inventory updated:', inventory.map(item => item.name))
    console.log('HUD: Inventory length:', inventory.length)
    console.log('HUD: Item counts:', itemCounts)
  }, [inventory, itemCounts])
  
  // Add debug log for score updates
  useEffect(() => {
    console.log('HUD: Score updated:', score)
  }, [score])
  
  // Add this inside the HUD component, after the HUD state declarations
  const [warningPulse, setWarningPulse] = useState(1);

  useEffect(() => {
    // Create a pulsing warning effect when snake is close to exploding
    let pulseInterval;
    if (gameInfo.snakeFatness > gameInfo.maxFatness * 0.6) {
      pulseInterval = setInterval(() => {
        setWarningPulse(prev => {
          // Faster pulsing as fatness increases
          const pulseSpeed = 0.05 + (gameInfo.snakeFatness / gameInfo.maxFatness) * 0.15;
          return Math.sin(Date.now() * pulseSpeed) * 0.5 + 1;
        });
      }, 16);
    } else {
      setWarningPulse(1);
    }
    
    return () => {
      if (pulseInterval) clearInterval(pulseInterval);
    };
  }, [gameInfo.snakeFatness, gameInfo.maxFatness]);
  
  return (
    <>
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        padding: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '8px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px',
        userSelect: 'none',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        maxWidth: '250px'
      }}>
        <div style={{ 
          marginBottom: '10px', 
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '20px', 
            color: '#ffdd44',
            textShadow: '0 0 5px rgba(255, 221, 68, 0.5)',
            fontWeight: 'bold'
          }}>
            Score: {score}
          </div>
        </div>
        
        {/* Snake fatness display */}
        <div style={{ 
          marginBottom: '12px', 
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ fontWeight: 'bold', color: '#aaffaa' }}>Fatness:</div>
          <div style={{ flex: 1 }}>
            <div style={{
              width: '100%',
              height: '12px',
              backgroundColor: '#333333',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, ((gameInfo?.snakeFatness || 0) / (gameInfo?.maxFatness || 1)) * 100)}%`,
                height: '100%',
                backgroundColor: (gameInfo?.snakeFatness || 0) > (gameInfo?.maxFatness || 5) * 0.8 ? '#f44336' : 
                               (gameInfo?.snakeFatness || 0) > (gameInfo?.maxFatness || 5) * 0.6 ? '#ff9800' : 
                               '#4CAF50',
                borderRadius: '6px',
                transition: 'width 0.3s ease, background-color 0.3s ease'
              }}></div>
            </div>
            <div style={{ fontSize: '12px', textAlign: 'right', marginTop: '2px' }}>
              {(gameInfo?.snakeFatness || 0).toFixed(1)}/{gameInfo?.maxFatness || 0}
            </div>
          </div>
        </div>
        
        {/* Active powerups */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Active Powerups:</div>
          {(!powerups?.speed?.active && !powerups?.invincible?.active && !powerups?.magnet?.active) ? (
            <div style={{ fontSize: '14px', color: '#aaa', fontStyle: 'italic' }}>None active</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {powerups?.speed?.active && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(0, 200, 255, 0.2)',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 200, 255, 0.4)'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    backgroundColor: '#00ccff',
                    borderRadius: '50%',
                    boxShadow: '0 0 5px #00ccff'
                  }}></div>
                  <div style={{ color: '#88ffff' }}>Speed Boost</div>
                  <div style={{ marginLeft: 'auto', fontSize: '12px' }}>{Math.ceil(powerups.speed.timeLeft)}s</div>
                </div>
              )}
              {powerups?.invincible?.active && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(255, 204, 0, 0.2)',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 204, 0, 0.4)'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    backgroundColor: '#ffcc00',
                    borderRadius: '50%',
                    boxShadow: '0 0 5px #ffcc00'
                  }}></div>
                  <div style={{ color: '#ffdd44' }}>Invincibility</div>
                  <div style={{ marginLeft: 'auto', fontSize: '12px' }}>{Math.ceil(powerups.invincible.timeLeft)}s</div>
                </div>
              )}
              {powerups?.magnet?.active && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(68, 255, 68, 0.2)',
                  borderRadius: '4px',
                  border: '1px solid rgba(68, 255, 68, 0.4)'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    backgroundColor: '#44ff44',
                    borderRadius: '50%',
                    boxShadow: '0 0 5px #44ff44'
                  }}></div>
                  <div style={{ color: '#aaffaa' }}>Treasure Magnet</div>
                  <div style={{ marginLeft: 'auto', fontSize: '12px' }}>{Math.ceil(powerups.magnet.timeLeft)}s</div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div style={{ marginBottom: '10px' }}>Depth: {Math.abs(depth).toFixed(1)}m</div>
        <div style={{ marginBottom: '10px' }}>
          View: <span style={{ color: '#aaffaa' }}>{viewMode === 'first-person' ? 'First Person' : 'Isometric'}</span>
          <span style={{ fontSize: '12px', display: 'block', marginTop: '2px', color: '#aaaaaa' }}>
            Press V to toggle view
          </span>
        </div>
        
        {/* Updated Inventory display with counts by type */}
        <div style={{ marginBottom: '5px' }}>Inventory (Total Items: {Object.values(itemCounts).reduce((sum, type) => sum + type.total, 0)}):</div>
        <div style={{ 
          maxHeight: '200px', 
          overflowY: 'auto',
          fontSize: '12px'
        }}>
          {Object.keys(itemCounts).length === 0 ? (
            <div>No items collected</div>
          ) : (
            Object.entries(itemCounts).map(([type, typeData]) => (
              <div key={type} style={{ marginBottom: '8px' }}>
                <div style={{
                  fontWeight: 'bold',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                  paddingBottom: '3px',
                  marginBottom: '5px',
                  color: type === 'food' ? '#ff9999' : 
                         type === 'powerup' ? '#9999ff' : 
                         type === 'treasure' ? '#ffff99' : '#ffffff'
                }}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}s ({typeData.total})
                </div>
                
                {Object.entries(typeData.items).map(([itemName, itemData]) => (
                  <div key={itemName} style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    marginBottom: '3px',
                    paddingLeft: '5px'
                  }}>
                    <div style={{ 
                      width: '10px', 
                      height: '10px', 
                      backgroundColor: itemData.color,
                      borderRadius: '50%',
                      boxShadow: type === 'food' || type === 'powerup' ? 
                                `0 0 3px ${itemData.color}` : 'none'
                    }}></div>
                    <div style={{flex: 1}}>{itemName}</div>
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '3px',
                      padding: '1px 4px',
                      fontWeight: 'bold'
                    }}>
                      x{itemData.count}
                    </div>
                    {itemData.enhanced > 0 && (
                      <div style={{
                        color: '#ffcc00',
                        fontSize: '10px',
                        backgroundColor: 'rgba(255, 204, 0, 0.2)',
                        borderRadius: '3px',
                        padding: '1px 3px',
                      }}>
                        +{itemData.enhanced}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* MiniMap and other components remain the same */}
      <MiniMap 
        snakePosition={snakePosition} 
        terrain={terrain} 
        viewMode={viewMode} 
      />
      
      {/* View mode indicator removed */}
      
      {gameInfo.snakeFatness > gameInfo.maxFatness * 0.6 && (
        <>
          <style jsx>{`
            @keyframes shake {
              0% { transform: translate(-50%, -50%) translate(1px, 1px) rotate(0deg); }
              10% { transform: translate(-50%, -50%) translate(-1px, -2px) rotate(-1deg); }
              20% { transform: translate(-50%, -50%) translate(-3px, 0px) rotate(1deg); }
              30% { transform: translate(-50%, -50%) translate(3px, 2px) rotate(0deg); }
              40% { transform: translate(-50%, -50%) translate(1px, -1px) rotate(1deg); }
              50% { transform: translate(-50%, -50%) translate(-1px, 2px) rotate(-1deg); }
              60% { transform: translate(-50%, -50%) translate(-3px, 1px) rotate(0deg); }
              70% { transform: translate(-50%, -50%) translate(3px, 1px) rotate(-1deg); }
              80% { transform: translate(-50%, -50%) translate(-1px, -1px) rotate(1deg); }
              90% { transform: translate(-50%, -50%) translate(1px, 2px) rotate(0deg); }
              100% { transform: translate(-50%, -50%) translate(1px, -2px) rotate(-1deg); }
            }
            .warning-message {
              animation: shake ${800 - Math.min(400, (gameInfo.snakeFatness / gameInfo.maxFatness - 0.6) * 400)}ms cubic-bezier(.36,.07,.19,.97) both infinite;
            }
          `}</style>
          <div 
            className="warning-message" 
            style={{
              color: `rgba(255, ${Math.max(0, 255 - (gameInfo.snakeFatness / gameInfo.maxFatness - 0.6) * 2000)}, ${Math.max(0, 255 - (gameInfo.snakeFatness / gameInfo.maxFatness - 0.6) * 1000)}, ${Math.min(1, 0.7 + (gameInfo.snakeFatness / gameInfo.maxFatness - 0.6) * 3)})`,
              fontSize: `${Math.min(32, 16 + (gameInfo.snakeFatness / gameInfo.maxFatness - 0.6) * 100)}px`,
              fontWeight: 'bold',
              textShadow: `0 0 ${5 + (gameInfo.snakeFatness / gameInfo.maxFatness - 0.6) * 20}px rgba(255, 0, 0, ${0.7 + (gameInfo.snakeFatness / gameInfo.maxFatness - 0.6) * 0.3})`,
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `scale(${warningPulse})`,
              zIndex: 1000,
              textAlign: 'center',
              width: '100%',
              padding: '20px',
              letterSpacing: `${Math.min(5, 1 + (gameInfo.snakeFatness / gameInfo.maxFatness - 0.6) * 20)}px`,
            }}
          >
            {gameInfo.snakeFatness > gameInfo.maxFatness * 0.85 ? 
              "IMMINENT EXPLOSION!!!" : 
              gameInfo.snakeFatness > gameInfo.maxFatness * 0.75 ? 
              "CRITICAL FATNESS LEVEL!" : 
              "WARNING: SNAKE IS GETTING BIGGER!"
            }
          </div>
        </>
      )}
    </>
  )
}

// Instructions component with minimize feature
function Instructions() {
  const [minimized, setMinimized] = useState(false);
  
  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      left: 10,
      padding: minimized ? '10px' : '15px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '10px',
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '14px',
      width: minimized ? 'auto' : '350px',
      pointerEvents: 'auto', // Enable interaction for the minimize button
      border: '1px solid rgba(100, 200, 100, 0.4)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(80, 200, 80, 0.2)',
      transition: 'all 0.3s ease'
    }}>
      {/* Minimize/Expand toggle button */}
      <div 
        onClick={() => setMinimized(!minimized)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          zIndex: 10,
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#aaffaa'
        }}>
          {minimized ? '+' : '-'}
        </div>
      </div>
      
      {minimized ? (
        // Minimized view just shows a hint
        <div style={{
          fontWeight: 'bold',
          fontSize: '12px',
          color: '#aaffaa'
        }}>
          Controls (click to expand)
        </div>
      ) : (
        // Full content
        <>
          <div style={{ 
            marginBottom: '15px', 
            fontWeight: 'bold', 
            fontSize: '18px', // Smaller title
            paddingBottom: '8px',
            borderBottom: '2px solid rgba(100, 250, 100, 0.3)',
          }}>
            Game Controls & Info
          </div>
      
      <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.3)', paddingBottom: '5px' }}>
        Controls:
      </div>
      
      <div style={{ display: 'flex', marginBottom: '10px' }}>
        <div style={{ width: '90px', fontWeight: 'bold', color: '#8BC34A' }}>Movement:</div>
        <div>
          <div><span style={{ color: '#FFEB3B' }}>W/↑</span>: Up-Left</div>
          <div><span style={{ color: '#FFEB3B' }}>S/↓</span>: Down-Right</div>
          <div><span style={{ color: '#FFEB3B' }}>A/←</span>: Up-Right</div>
          <div><span style={{ color: '#FFEB3B' }}>D/→</span>: Down-Left</div>
        </div>
      </div>
      
      <div style={{ display: 'flex', marginBottom: '10px' }}>
        <div style={{ width: '90px', fontWeight: 'bold', color: '#FF5722' }}>Objective:</div>
        <div>
          <div>Eat food to grow longer</div>
          <div>Collect powerups</div>
          <div>Find treasures for points</div>
        </div>
      </div>
      
      <div style={{ 
        marginBottom: '8px', 
        fontWeight: 'bold', 
        fontSize: '14px', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.3)', 
        paddingBottom: '5px', 
        marginTop: '10px', 
        color: '#4CAF50'
      }}>
        Collectibles:
      </div>
      
      <div style={{ display: 'flex', marginBottom: '6px' }}>
        <div style={{ width: '90px', fontWeight: 'bold', color: '#ff6b6b' }}>Food:</div>
        <div>
          <div style={{ fontSize: '12px' }}>Apple, Banana, Blueberry</div>
        </div>
      </div>
      
      <div style={{ display: 'flex', marginBottom: '6px' }}>
        <div style={{ width: '90px', fontWeight: 'bold', color: '#00ccff' }}>Powerups:</div>
        <div style={{ fontSize: '12px' }}>
          <div><span style={{ color: '#88ffff' }}>Speed</span>, <span style={{ color: '#ffdd44' }}>Invincibility</span>, <span style={{ color: '#aaffaa' }}>Magnet</span></div>
        </div>
      </div>
      
      <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px', fontStyle: 'italic', padding: '5px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '5px' }}>
        TIP: Look for glowing trails to find your snake if it gets lost
      </div>
        </>
      )}
    </div>
  )
}

// FPS Counter component (to be used inside Canvas)
function FpsCounter({ onFpsUpdate }) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  
  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    const delta = now - lastTime.current;
    
    // Update FPS every 0.5 seconds
    if (delta > 500) {
      const fps = Math.round((frameCount.current * 1000) / delta);
      if (onFpsUpdate) onFpsUpdate(fps);
      frameCount.current = 0;
      lastTime.current = now;
    }
  });
  
  return null;
}

// Main game component
export default function SnakeGame() {
  // Game state
  const [gameStarted, setGameStarted] = useState(false)
  const [selectedSnake, setSelectedSnake] = useState(null)
  const [viewMode, setViewMode] = useState('isometric')
  const [inventory, setInventory] = useState([])
  const [score, setScore] = useState(0)
  const [foundTreasure, setFoundTreasure] = useState(null)
  const [depth, setDepth] = useState(0)
  const [layer, setLayer] = useState(LAYERS[0])
  const [fps, setFps] = useState(0)
  const [currentLayer, setCurrentLayer] = useState(LAYERS[0])
  // Add notification queue
  const notificationQueue = useRef([]).current;

  // Update current layer based on depth
  useEffect(() => {
    const newLayer = getLayerByDepth(Math.abs(depth))
    setCurrentLayer(newLayer)
  }, [depth])

  useEffect(() => {
    // Listen for view mode toggle
    const handleKeyDown = (e) => {
      if (KEYS.TOGGLE_VIEW.includes(e.key)) {
        setViewMode(prev => prev === 'first-person' ? 'isometric' : 'first-person')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  const handleSnakeSelect = (snake) => {
    setSelectedSnake(snake)
    setGameStarted(true)
  }
  
  const handleTreasureCollect = (item, itemValue) => {
    console.log('handleTreasureCollect called with item:', item.name, 'value:', itemValue, 'current inventory size:', inventory.length)
    
    // Don't show notification for duplicate items or if one is already showing
    if (!foundTreasure) {
      setFoundTreasure(item);
      
      // Auto-close notification after 1.5 seconds
      setTimeout(() => {
        setFoundTreasure(null);
        
        // Process next item in queue after this one closes
        if (notificationQueue.length > 0) {
          const nextItem = notificationQueue.shift();
          setFoundTreasure(nextItem);
          setTimeout(() => setFoundTreasure(null), 1500);
        }
      }, 1500);
    } else {
      // Add to queue if we're already showing a notification
      // Keep queue size reasonable
      if (notificationQueue.length < 5) {
        notificationQueue.push(item);
      }
    }
    
    // Update score
    setScore(prev => prev + itemValue)
    
    // IMPROVED INVENTORY MANAGEMENT WITH ITEM COUNTING
    
    // Define item categories for combining similar items
    const combineCategories = {
      gems: ['Diamond', 'Ruby', 'Emerald'],
      metals: ['Gold Nugget', 'Silver Ore', 'Copper Ore', 'Iron Ore'],
      foods: ['Apple', 'Blueberry', 'Banana', 'Golden Apple', 'Crystal Fruit'],
      stones: ['Common Stone', 'Ancient Fossil', 'Magma Crystal'],
      powerups: ['Speed Boost', 'Invincibility', 'Treasure Magnet']
    };
    
    // Find which category this item belongs to
    const itemCategory = Object.entries(combineCategories).find(([category, items]) => 
      items.includes(item.name)
    )?.[0] || 'misc';
    
    setInventory(prev => {
      // Reset inventory if it's too large (something went wrong)
      if (prev.length > MAX_INVENTORY_SIZE * 2) {
        console.log('Inventory corrupted or too large! Resetting...');
        return [];
      }
      
      // Look for existing item of the same name or create a new entry with count
      const existingItemIndex = prev.findIndex(invItem => 
        invItem.name === item.name && invItem.type === item.type
      );
      
      if (existingItemIndex >= 0) {
        // Update count for existing item
        const newInventory = [...prev];
        const existingItem = newInventory[existingItemIndex];
        
        newInventory[existingItemIndex] = {
          ...existingItem,
          count: (existingItem.count || 1) + 1,
          value: existingItem.value + Math.floor(item.value / 2), // Boost value as before
          // Track total collected value for statistics
          totalValue: (existingItem.totalValue || existingItem.value) + item.value,
          enhanced: (existingItem.enhanced || 0) + 1, // Track enhancement level
          // Slightly brighten color on enhancement
          color: existingItem.color.startsWith('#') 
            ? `#${Math.min(255, parseInt(existingItem.color.slice(1, 3), 16) + 10).toString(16).padStart(2, '0')}${existingItem.color.slice(3)}`
            : existingItem.color
        };
        
        console.log(`Collected ${item.name}, new count: ${newInventory[existingItemIndex].count}`);
        return newInventory;
      } else {
        // Hard limit - enforce MAX_INVENTORY_SIZE
        if (prev.length >= MAX_INVENTORY_SIZE) {
          console.log('Inventory full! Cannot add item:', item.name);
          
          // Try to combine with existing items of same category
          if (itemCategory !== 'misc') {
            // Find items in the same category
            const sameCategory = prev.filter(invItem => 
              combineCategories[itemCategory]?.includes(invItem.name)
            );
            
            if (sameCategory.length > 0) {
              // Create an enhanced version of an existing item
              const targetItem = sameCategory[0];
              const enhancedItem = {
                ...targetItem,
                name: `Enhanced ${targetItem.name}`,
                value: targetItem.value + Math.floor(item.value / 2),
                enhanced: (targetItem.enhanced || 0) + 1,
                count: (targetItem.count || 1), // Keep existing count
                // Track total collected value
                totalValue: (targetItem.totalValue || targetItem.value) + item.value,
                // Slightly change color
                color: targetItem.color.startsWith('#') 
                  ? `#${Math.min(255, parseInt(targetItem.color.slice(1, 3), 16) + 10).toString(16).padStart(2, '0')}${targetItem.color.slice(3)}`
                  : targetItem.color
              };
              
              // Replace the old item with the enhanced one
              return prev.map(invItem => 
                invItem === targetItem ? enhancedItem : invItem
              );
            }
            
            // If we can't combine, we might replace the lowest value item
            const lowestValueItem = [...prev].sort((a, b) => a.value - b.value)[0];
            if (lowestValueItem && lowestValueItem.value < item.value) {
              console.log('Replacing lowest value item:', lowestValueItem.name, 'with', item.name);
              return prev.map(invItem => 
                invItem === lowestValueItem ? {...item, count: 1} : invItem
              );
            }
          }
          return prev;
        }
        
        // Add new item with count
        console.log('Adding new item to inventory:', item.name);
        return [...prev, {...item, count: 1}];
      }
    });
    
    // Auto-close notification after just 1.5 seconds for better gameplay flow
    setTimeout(() => {
      setFoundTreasure(null)
    }, 1500)
  }
  
  // Get current state for HUD components
  const [currentSnakePosition, setCurrentSnakePosition] = useState([0, 0, 0])
  const [currentTerrain, setCurrentTerrain] = useState({})
  const [currentDirection, setCurrentDirection] = useState(0)
  const [currentGameInfo, setCurrentGameInfo] = useState({
    snakeLength: INITIAL_SNAKE_LENGTH,
    powerups: {
      speed: { active: false, timeLeft: 0 },
      invincible: { active: false, timeLeft: 0 },
      magnet: { active: false, timeLeft: 0 }
    }
  })
  
  // Update game state for HUD components
  const handleGameStateUpdate = (position, terrain, direction, gameInfo) => {
    setCurrentSnakePosition(position)
    setCurrentTerrain(terrain)
    setCurrentDirection(direction)
    setDepth(position[1])
    
    // Update additional game info if provided
    if (gameInfo) {
      // Remove these lines as they reference undefined variables
      // gameInfo.snakeFatness = snakeFatness;
      // gameInfo.maxFatness = MAX_SNAKE_FATNESS;
      setCurrentGameInfo(gameInfo)
    }
  }

  const handleFpsUpdate = (newFps) => {
    setFps(newFps);
  }
  
  return (
    <>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <Canvas shadows>
          <Suspense fallback={null}>
            {gameStarted ? (
              <>
                <WorldManager 
                  selectedSnakeType={selectedSnake} 
                  inventory={inventory}
                  setInventory={setInventory}
                  onTreasureCollect={handleTreasureCollect}
                  onGameStateUpdate={handleGameStateUpdate}
                  score={score} // Pass current score to WorldManager
                  setScore={setScore} // Pass setScore to WorldManager
                />
                
                {/* FPS Counter inside the Canvas where useFrame works */}
                <FpsCounter onFpsUpdate={handleFpsUpdate} />
                
                {/* Other Canvas components */}
              </>
            ) : (
              <>
                <OrbitControls enableZoom={false} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <Sky distance={450000} sunPosition={[0, 1, 0]} />
                
                {/* Preview snake models */}
                <group>
                  {SNAKE_TYPES.map((type, index) => (
                    <group 
                      key={type.name} 
                      position={[index * 4 - 6, 0, 0]}
                      rotation={[0, Math.PI / 4, 0]}
                    >
                      <SnakeSegment
                        position={[0, 0, 0]}
                        rotation={[0, 0, 0]}
                        isHead={true}
                        type={type}
                        scale={1.5}
                      />
                      <SnakeSegment
                        position={[0, 0, -1.2]}
                        rotation={[0, 0, 0]}
                        isHead={false}
                        type={type}
                        scale={1.4}
                      />
                      <SnakeSegment
                        position={[0, 0, -2.3]}
                        rotation={[0, 0, 0]}
                        isHead={false}
                        type={type}
                        scale={1.3}
                      />
                    </group>
                  ))}
                </group>
              </>
            )}
            
            <Environment preset="sunset" />
          </Suspense>
        </Canvas>

        {/* UI overlays */}
        {gameStarted && (
          <>
            <LayerIndicator currentDepth={currentSnakePosition[1]} fps={fps} />
            <HUD 
              key={`hud-${Object.values(inventory).reduce((sum, item) => sum + (item.count || 1), 0)}-${score}`} 
              score={score} 
              inventory={inventory}
              depth={currentSnakePosition[1]}
              layer={currentLayer}
              viewMode={viewMode}
              snakePosition={[...currentSnakePosition, currentDirection]}
              terrain={currentTerrain}
              gameInfo={currentGameInfo}
            />
            <Instructions />
            
            {foundTreasure && (
              <TreasureNotification 
                item={foundTreasure}
                visible={!!foundTreasure}
                onClose={() => setFoundTreasure(null)}
              />
            )}
          </>
        )}
      </div>
      
      {!gameStarted && (
        <SnakeSelector onSelect={handleSnakeSelect} />
      )}
    </>
  )
}