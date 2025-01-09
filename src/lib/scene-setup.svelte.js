import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, buildingObjects = [], markerObject;

let meshGroup = new THREE.Group();

let centerOffset;

let sizes = {
  width: 700,
  height: 300
}

export const initThreeScene = () => {
  const threeCanvas = document.getElementById('three-canvas');

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000);
  camera.position.set(3, 10, 10);

  const controls = new OrbitControls(camera, threeCanvas);
  controls.enableDamping = true; // Smooth camera motion
  controls.dampingFactor = 0.05; // Adjust as needed
  controls.screenSpacePanning = false; // Prevents up/down camera translation
  controls.minDistance = 5; // Minimum zoom distance
  controls.maxDistance = 50; // Maximum zoom distance
  controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation

  renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true });
  renderer.setSize(sizes.width, sizes.height);

  // const mesh = new THREE.Mesh(
  //     new THREE.BoxGeometry(1, 1, 1, 5, 5, 5),
  //     new THREE.MeshBasicMaterial({ color: 0xff0000 })
  // )
  // scene.add(mesh)
  // camera.lookAt(mesh.position)
  // // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 10, 10).normalize();
  scene.add(light);

  const clock = new THREE.Clock()
  // Animation Loop
  const animate = () => {
    const elapsedTime = clock.getElapsedTime()
    if(markerObject) {
      // const radius = 3; // Distance from the center of the scene
      // const speed = 0.1; // Angular speed (adjust as needed)

      // // Update camera position
      // camera.position.x = radius * Math.cos(speed * elapsedTime);
      // camera.position.z = radius * Math.sin(speed * elapsedTime);
      // camera.lookAt(0, 0, 0); // Keep the camera focused on the scene's center
    }
    controls.update();
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  };
  animate();
};

export const syncClickedBuildings = (clickedBuildings) => {
  console.log("in sync clicked buildings")
  clickedBuildings.subscribe((buildings) => {
    // Clear existing objects
    buildingObjects.forEach((obj) => scene.remove(obj));
    buildingObjects = [];

    // Add new building objects
    buildings.forEach((building) => {
      
      // const geometry = new THREE.BoxGeometry(1, 1, building.height || 1);
      // const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
      // const buildingMesh = new THREE.Mesh(geometry, material);

      // Position the building (convert lat/lng to arbitrary 3D coords)
      console.log("making building with centeroffset", centerOffset, " and building loc at ", building.location)
      const lat = centerOffset[0];
      const lng = centerOffset[1];

      const extrudeSettings = {
        depth: building.height || 1
      }
      const buildingBase = new THREE.Shape()
      console.group("Drawing base")
      console.log("moving to 0,0")
      
      const startPos = building.location[0][0]
      const scaleFactor = 100000
      buildingBase.moveTo((lng - startPos[0]) * scaleFactor, (lat - startPos[1]) * scaleFactor)
      
      building.location[0].slice(1).forEach((coords) => {
        console.log(
         "moving to ", (lng - coords[0]) * scaleFactor, (lat - coords[1]) * scaleFactor, 
         " because lng lat are ", lng ,lat, " and coords are ", coords
        )
        buildingBase.lineTo((lng - coords[0]) * scaleFactor, (lat - coords[1]) * scaleFactor)
      })
      buildingBase.moveTo((lng - startPos[0]) * scaleFactor, (lat - startPos[1]) * scaleFactor)
      console.groupEnd();

      const buildingMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(buildingBase, extrudeSettings),
        new THREE.MeshBasicMaterial({color: 0x00ff00, wireframe: false, opacity: 0.1, transparent: true})
      )
      buildingMesh.rotation.x = 90 * Math.PI / 180
      console.log("created new mesh at", buildingMesh.position, "with size", building.height || 1)

      meshGroup.add(buildingMesh);
      // scene.add(buildingMesh);
      buildingObjects.push(buildingMesh);

    });
    console.log('Building objects added to scene:', buildingObjects);
  });
};

export const syncMarker = (position) => {
  $effect(() => {
    if (!position || position.length != 2) return;

    console.log("setting centeroffset to ", position)
    if(position.length == 2) {
      centerOffset = position;
    }

    // Remove existing marker object
    if (markerObject) {
      scene.remove(markerObject);
    }

    // Add new marker object
    markerObject = new THREE.Mesh(
      new THREE.SphereGeometry(0.75),
      new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: false, opacity: 0.2 })
    )
    meshGroup.add(markerObject);
    scene.add(meshGroup);
    // scene.add(markerObject);
    camera.lookAt(meshGroup.position);
    console.log('Marker added to scene:', markerObject);
  });
};