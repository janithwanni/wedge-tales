<script>
  import {onMount, onDestroy} from 'svelte';
  import { writable } from 'svelte/store';
	import MapPin from '$lib/components/MapPin.svelte';
  import { initThreeScene, syncClickedBuildings, syncMarker } from '$lib/scene-setup.svelte.js';

  let { data } = $props();
  let accessToken = data.accessToken;
  
  let mapContainer;
  let searchBoxContainer;
  
  let marker;
  let map = $state(undefined);

  let dropMarker = $state(undefined);
  
  let markerPosition = $state([]); // [lat, lng]

  const sceneMarker = writable(null);
  const clickedBuildings = writable([]);
  const highlightedFeatures = writable([]);

  $effect(() => {
    if(map !== undefined && markerPosition.length == 2) {
      // map is set and marker is set
      if (marker) {
        marker.remove();
      }

      // Add new marker
      marker = new mapboxgl.Marker()
        .setLngLat([markerPosition[1], markerPosition[0]])
        .addTo(map);

      // Center the map on the new marker
      map.flyTo({
        center: [markerPosition[1], markerPosition[0]],
        zoom: 15,
        essential: true,
      });

      syncMarker(markerPosition)
    }
  })
  

  let getCurrentLocation = () => {
    console.log("fired event");
    if("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        console.log(position)
        const {latitude, longitude} = position.coords;

        markerPosition = [latitude, longitude];
      })
    } else {
      console.log("Can't get current location")
    }
  }

  onMount(async () => {
    mapboxgl.accessToken = accessToken;
    map = new mapboxgl.Map({
      container: 'map', // container I
      style: 'mapbox://styles/mapbox/light-v11',
      center: [145.130, -37.909],
      zoom: 15.5,
      // pitch: 45,
      // bearing: -17.6,
      container: 'map',
      antialias: true
    });


    const searchBoxElement = new mapboxsearch.MapboxSearchBox()
    searchBoxElement.accessToken = accessToken;
    searchBoxElement.options = {
      language: 'en',
    }

    searchBoxElement.addEventListener("retrieve", (event) => {
      console.log(event.detail.features[0].geometry);
      const [searchLng, searchLat] = event.detail.features[0].geometry.coordinates;
      console.log("Setting markerPosition to", searchLat, searchLng)
      markerPosition = [searchLat, searchLng];
    })
    searchBoxContainer.appendChild(searchBoxElement);

    initThreeScene();
    // Sync building data
    
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
        console.log("got new building", building);
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
            clickedBuildings.update((list) => {
              console.log("adding building with coordinates", coordinates)
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
        syncClickedBuildings(clickedBuildings);

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
  })
</script>

<div class = "container h-screen mx-auto px-4 py-6 flex flex-col">

    <div class="text-3xl basis-1/12 text-green-600">Wedge Tales</div>

    <div class="text-lg text-gray-500"><span class = "text-base font-bold text-white bg-green-600 border-4 border-green-600 border-solid rounded-full mr-4 inline-flex justify-center items-center w-fit min-w-12 aspect-square"> 1 </span>Enter details of the station</div>

    
    
    <div id = "station-name-controls" class="basis-1/12 text-6xl py-4">
      <input 
        class = "border-b-2 border-solid border-gray-200 rounded-md px-1"
        type = "text"
        placeholder="My new weather station" /> located at
    </div>

    <div id = "station-location-controls" class="py-4 basis-1/12">
      <span class = "min-w-96 pr-8 inline-block" bind:this={searchBoxContainer}></span>
      <button aria-label="Set Current Location" onclick={getCurrentLocation}> 
        <MapPin label="Use my location"/>
      </button>
    </div>

    <div class = "pb-4 flex flex-row">
      <label for="latinput" class="mr-4"> Latitude </label>
      <input
        class = "border-b-2 border-solid border-gray-200 rounded-md px-1 mx-2"
        type="text"
        placeholder="Enter Latitude"
        bind:value={markerPosition[0]}
      />

      <label for="lnginput" class="mr-4">Longitude</label>
      <input
        class = "border-b-2 border-solid border-gray-200 rounded-md px-1 mx-2"
        type="text"
        placeholder="Enter Longitude"
        bind:value={markerPosition[1]}
      />
    </div>

    <div>
      <button class="bg-sky-600 text-white py-2 px-8 rounded-md"> Save </button>
    </div>

    <div class="text-gray-500 text-lg pt-6"><span class = "text-base text-white font-bold bg-green-600 border-4 border-green-600 border-solid rounded-full mr-4 inline-flex justify-center items-center w-fit min-w-12 aspect-square"> 2 </span>Select obstructions around weather station</div>



    <!-- <div id = "carousel-controls" class="ml-auto mr-auto">
      <button class="bg-sky-600 text-white py-2 px-4 rounded-md"> Map View </button>
      <button class="bg-sky-600 text-white py-2 px-4 rounded-md"> Scene View </button>
    </div> -->

    <div id = "carousel" class="flex flex-row grow py-8">
      <div id='map' class="w-screen min-h-64" bind:this="{mapContainer}"></div>
      <div id = "threejs-scene" class="w-screen min-h-64"><canvas id = "three-canvas"></canvas></div>
    </div>
  
</div>

<style>
  /* #map {
    position: absolute;
    width: 100%;
    height: 100%;
  } */
</style>