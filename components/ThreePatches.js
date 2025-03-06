// This file patches THREE.js to provide a BatchedMesh export 
// for compatibility with three-mesh-bvh

import * as THREE from 'three';

// Only add BatchedMesh if it doesn't exist already
if (!THREE.BatchedMesh) {
  // Create a minimal stub implementation that won't break imports
  THREE.BatchedMesh = class BatchedMesh extends THREE.Mesh {
    constructor() {
      super();
      console.warn('BatchedMesh is not available in this version of Three.js');
    }
  };
}

export default THREE; 