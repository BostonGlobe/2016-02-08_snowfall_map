'use strict';

(function () {
	// global variables
	let map;
	let data;
	let markersLayer;

	// called once on page load
	const init = function () {
		setupMap();
		setHeight();
		loadData();
	};

	// called automatically on page resize
	window.onPymParentResize = function (width) {};

	const loadData = function () {
		const el = document.createElement('script');
		el.setAttribute('src', 'temp/snowfall_scraper.jsonp');
		document.body.appendChild(el);
	};

	const setHeight = function () {
		if (window.pymChild) {
			window.pymChild.sendMessage('height-request', true);
			window.pymChild.onMessage('height-send', function (msg) {
				var initialHeight = +msg;
				document.getElementById('map').style.height = Math.floor(initialHeight * 0.67) + 'px';
			});
		} else {
			setTimeout(setHeight, 30);
		}
	};

	// graphic code
	const setupMap = function () {

		L.mapbox.accessToken = 'pk.eyJ1IjoiZ2FicmllbC1mbG9yaXQiLCJhIjoiVldqX21RVSJ9.Udl7GDHMsMh8EcMpxIr2gA';
		map = L.mapbox.map('map', 'gabriel-florit.36cf07a4', {
			attributionControl: false,
			scrollWheelZoom: false,
			maxBounds: [[24, -93], [51, -60]]
		});

		map.setView([42.25, -71.82], 7);

		map.on('zoomend', function (e) {
			addMarkersToMap(map.getZoom());
		});
	};

	const getIconDimensions = function (zoom) {
		return {
			6: {
				width: 34,
				height: 21
			},
			7: {
				width: 34,
				height: 21
			},
			8: {
				width: 45,
				height: 27
			},
			9: {
				width: 45,
				height: 27
			},
			10: {
				width: 60,
				height: 36
			}
		}[zoom];
	};

	const intersectRect = function (r1, r2) {
		return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
	};

	const addMarkersToMap = function (zoom) {

		var iconDimensions = getIconDimensions(zoom);

		var ICON_WIDTH = iconDimensions.width;
		var ICON_HEIGHT = iconDimensions.height;

		var markers = [];

		// for each point,
		// find the absolute pixel coordinates for the given zoom level
		// assuming we're center aligning the point,
		// find the point's bounding box in pixel coordinates
		const byLat = data.sort((a, b) => b['Latitude'] - a['Latitude']);
		const byLng = data.sort((a, b) => a['Longitude'] - b['Longitude']);
		const byAmount = data.sort((a, b) => b['Amount'] - a['Amount']);

		byAmount.map((point, index) => {
			var pointCoords = map.project([point['Latitude'], point['Longitude']]);

			var pointBBox = {
				left: pointCoords.x - ICON_WIDTH / 2,
				right: pointCoords.x + ICON_WIDTH / 2,
				bottom: pointCoords.y + ICON_HEIGHT / 2,
				top: pointCoords.y - ICON_HEIGHT / 2
			};

			// make sure this bbox doesn't overlap with any existing markers
			var overlaps = _.some(markers, function (marker) {

				var markerCoords = map.project(marker._latlng);

				var markerBBox = {
					left: markerCoords.x - ICON_WIDTH / 2,
					right: markerCoords.x + ICON_WIDTH / 2,
					bottom: markerCoords.y + ICON_HEIGHT / 2,
					top: markerCoords.y - ICON_HEIGHT / 2
				};

				return intersectRect(pointBBox, markerBBox);
			});

			// if it doesn't overlap, add to markers layer
			if (!overlaps) {

				var icon = L.divIcon({
					html: '<span class="wrapper _zoom' + zoom + '"><span class="label">' + point['Amount'] + '”</span></span>',
					className: 'snowfall'
				});

				var marker = L.marker([point['Latitude'], point['Longitude']], {
					icon: icon,
					clickable: false
				});
				markers.push(marker);
			}
		});

		if (markersLayer) {
			map.removeLayer(markersLayer);
		}

		markersLayer = L.layerGroup(markers);

		markersLayer.addTo(map);
	};

	window.snowfall_scraper = function (response) {
		const dataset = 'climate';

		data = response[dataset].map(el => {
			el['Latitude'] = parseFloat(el['Latitude']);
			el['Longitude'] = parseFloat(el['Longitude']);
			el['Amount'] = parseFloat(el['Amount']);
			return el;
		});

		addMarkersToMap(map.getZoom());

		// const geojson = createGeoJSON(clean);

		// var gj = L.geoJson(geojson, {
		//   		pointToLayer: function(feature, ll) {
		//       		return L.marker(ll, {
		//           		icon: L.divIcon({
		//                	className: 'label',
		//                	html: feature.properties.title
		//            	})
		//       		});
		//   		}
		// }).addTo(map);
	};

	const createGeoJSON = function (data) {
		const geojson = data.map(el => {
			return {
				'type': 'Feature',
				'geometry': {
					'type': 'Point',
					'coordinates': [el['Longitude'], el['Latitude']]
				},
				'properties': {
					'title': el['Amount']
				}
			};
		});

		return geojson;
	};

	// run code
	init();
})();