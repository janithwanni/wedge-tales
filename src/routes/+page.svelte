<script>
  import {onMount, onDestroy} from 'svelte';
  import { writable } from 'svelte/store';
  import * as THREE from 'three';
  let { data } = $props();
  let accessToken = data.accessToken;
  
  
  let mapContainer;
  let latInput = $state('-37.909');
  let lngInput = $state('145.130');
  let marker;
  let dropMarker = $state(undefined);
  let scene, camera, renderer, buildingObjects = [], markerObject;
  const markerPosition = writable(null);
  const clickedBuildings = writable([]);
  const highlightedFeatures = writable([]);

  const initThreeScene = () => {
    const threeCanvas = document.getElementById('three-canvas');

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, threeCanvas.offsetWidth / threeCanvas.offsetHeight, 0.1, 1000);
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true });
    renderer.setSize(threeCanvas.offsetWidth, threeCanvas.offsetHeight);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10).normalize();
    scene.add(light);

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Sync building data
    syncClickedBuildings();
    syncMarker();
  };

  const syncClickedBuildings = () => {
    clickedBuildings.subscribe((buildings) => {
      // Clear existing objects
      buildingObjects.forEach((obj) => scene.remove(obj));
      buildingObjects = [];

      // Add new building objects
      buildings.forEach((building) => {
        
        const geometry = new THREE.BoxGeometry(10, 10, building.height || 10);
        const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
        const buildingMesh = new THREE.Mesh(geometry, material);

        // Position the building (convert lat/lng to arbitrary 3D coords)
        buildingMesh.position.set(
          building.location[0] * 0.1, // Scale longitude for scene
          building.location[1] * 0.1, // Scale latitude for scene
          building.height / 2 || 5 // Center the building height
        );

        scene.add(buildingMesh);
        buildingObjects.push(buildingMesh);
      });
      console.log('Building objects added to scene:', buildingObjects);
    });
  };

  const syncMarker = () => {
    markerPosition.subscribe((position) => {
      if (!position) return;

      // Remove existing marker object
      if (markerObject) {
        scene.remove(markerObject);
      }

      // Add new marker object
      const geometry = new THREE.SphereGeometry(5, 32, 32);
      const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      markerObject = new THREE.Mesh(geometry, material);

      markerObject.position.set(
        position.longitude * 0.1, // Scale longitude for scene
        position.latitude * 0.1,  // Scale latitude for scene
        5 // Arbitrary height
      );

      scene.add(markerObject);
      console.log('Marker added to scene:', markerObject);
    });
  };

  onMount(() => {
    console.log(accessToken)
    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container: 'map', // container I
      style: 'mapbox://styles/mapbox/light-v11',
      center: [145.130, -37.909],
      zoom: 15.5,
      // pitch: 45,
      // bearing: -17.6,
      container: 'map',
      antialias: true
    });

    initThreeScene();
    

    map.on('style.load', () => {
        // Insert the layer beneath any symbol layer.
        const layers = map.getStyle().layers;
        const labelLayerId = layers.find(
            (layer) => layer.type === 'symbol' && layer.layout['text-field']
        ).id;

        // The 'building' layer in the Mapbox Streets
        // vector tileset contains building height data
        // from OpenStreetMap.
        map.addLayer(
            {
                'id': 'add-3d-buildings',
                'source': 'composite',
                'source-layer': 'building',
                'filter': ['==', 'extrude', 'true'],
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                    'fill-extrusion-color': '#aaa',

                    // Use an 'interpolate' expression to
                    // add a smooth transition effect to
                    // the buildings as the user zooms in.
                    'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'height']
                    ],
                    'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'min_height']
                    ],
                    'fill-extrusion-opacity': 0.6
                }
            },
            labelLayerId
        );

        // Add highlight layer for clicked buildings
        map.addLayer({
          id: 'highlighted-buildings',
          type: 'fill-extrusion',
          source: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [], // Initially empty
            },
          },
          paint: {
            'fill-extrusion-color': '#ff0000',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.8,
          },
        });

    });

    map.on('click', (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['add-3d-buildings'], // Specify the layer to query
      });

      if (features.length > 0) {
        const building = features[0]; // Get the first feature
        const { height, min_height } = building.properties;
        const { coordinates } = building.geometry;

        // Update highlighted features list
        highlightedFeatures.update((featuresList) => {
          const exists = featuresList.find((f) => f.id === building.id);

          if (exists) {
            clickedBuildings.update((list) =>
              list.filter((b) => b.id !== building.id)
            );
            // Remove the building if it is already highlighted
            return featuresList.filter((f) => f.id !== building.id);
          } else {
            // Add the building to highlights
            console.log(building)
            clickedBuildings.update((list) => {
                return [
                  ...list,
                  {
                    id: building.id,
                    location: coordinates,
                    height: height || 'Unknown height',
                    baseHeight: min_height || 'Unknown base height',
                  },
                ]
            });
            return [...featuresList, building];
          }
        });

        // Update the highlight layer's data
        highlightedFeatures.subscribe((featuresList) => {
          const geojson = {
            type: 'FeatureCollection',
            features: featuresList,
          };
          map.getSource('highlighted-buildings').setData(geojson);
        });
      } else {
        console.log('No building clicked');
      }
    });

    dropMarker = () => {
      const latitude = parseFloat(latInput);
      const longitude = parseFloat(lngInput);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        // Remove existing marker if any
        if (marker) {
          marker.remove();
        }

        // Add new marker
        marker = new mapboxgl.Marker()
          .setLngLat([longitude, latitude])
          .addTo(map);

        markerPosition.set({ latitude, longitude });

        // Center the map on the new marker
        map.flyTo({
          center: [longitude, latitude],
          zoom: 15,
          essential: true,
        });
      } else {
        alert('Please enter valid latitude and longitude.');
      }
    };
  })
</script>

<div class = "container h-screen mx-auto px-4 py-12 grid grid-cols-6 grid-rows-4 grid-flow-row gap-4">
    <div class = "h-full w-full col-span-6 row-span-3" id='map' bind:this="{mapContainer}"></div>

    <div>
      Metadata area
      
      <div class="controls">
        <input
          type="text"
          placeholder="Enter Latitude"
          bind:value={latInput}
        />
        <input
          type="text"
          placeholder="Enter Longitude"
          bind:value={lngInput}
        />
        <button onclick={dropMarker}>Drop Marker</button>
      </div>
    </div>
    <div class = "col-span-3">
      <canvas id="three-canvas"></canvas>
    </div>
    <div>List of obstructions

      <ul>
        {#each $clickedBuildings as building, index}
          <li>
            <strong>Building {index + 1}:</strong><br />
            Location: {JSON.stringify(building.location).substring(0, 100) + "..."}<br />
            Height: {building.height} meters<br />
            Base Height: {building.baseHeight} meters
          </li>
        {/each}
      </ul>

    </div>
  
</div>

<style>
  /* #map {
    position: absolute;
    width: 100%;
    height: 100%;
  } */
</style>