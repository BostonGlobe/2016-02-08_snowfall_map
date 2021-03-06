'use strict';

(function () {
	// global variables
	var map = undefined;
	var data = undefined;
	var markersLayer = undefined;

	var scale = [
		{ 'amount': 0.1, 'hex': '#DDE6F1' },
		{ 'amount': 1, 'hex': '#bacce3' },
		{ 'amount': 2, 'hex': '#b5c6df' },
		{ 'amount': 4, 'hex': '#adb7d8' },
		{ 'amount': 6, 'hex': '#a5aad0' },
		{ 'amount': 8, 'hex': '#9f9cc8' },
		{ 'amount': 10, 'hex': '#998cbf' },
		{ 'amount': 15, 'hex': '#8a69a8' },
		{ 'amount': 20, 'hex': '#7a468c' },
		{ 'amount': 25, 'hex': '#65246d' },
		{ 'amount': 30, 'hex': '#4d004b' }
	];

	// called once on page load
	var init = function init() {
		setupMap();
		setHeight();
		loadData();
	};

	// called automatically on page resize
	window.onPymParentResize = function (width) {};

	var loadData = function loadData() {
		var el = document.createElement('script');
		el.setAttribute('src', 'https://www.bostonglobe.com/partners/snowfallscraper/snowfall_scraper.json');
		document.body.appendChild(el);
	};

	var setHeight = function setHeight() {
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

	var setupMap = function setupMap() {

		var defaultZoom = window.innerWidth < 640 ? 7 : 8;

		L.mapbox.accessToken = 'pk.eyJ1IjoiZ2FicmllbC1mbG9yaXQiLCJhIjoiVldqX21RVSJ9.Udl7GDHMsMh8EcMpxIr2gA';
		map = L.mapbox.map('map', 'gabriel-florit.36cf07a4', {
			attributionControl: false,
			scrollWheelZoom: false,
			minZoom: 7,
			maxZoom: 10,
			maxBounds: [[24, -93], [51, -60]]
		});

		map.setView([42.25, -71.82], defaultZoom);

		// we came up with these after much tweaking
		var customBounds = [
			[21.1, -83],
			[49.65, -66]
		];

		// Add the snowfall image to the map.
		var imageLayer = L.imageOverlay('//amzncache.boston.com/partners/snow/output.png', customBounds).addTo(map);

		map.on('zoomend', function (e) {
			addMarkersToMap(map.getZoom());
		});
	};

	var getIconDimensions = function getIconDimensions(zoom) {
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

	var intersectRect = function intersectRect(r1, r2) {
		return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
	};

	var addMarkersToMap = function addMarkersToMap(zoom) {

		var max = getMax(data);

		var iconDimensions = getIconDimensions(zoom);

		var ICON_WIDTH = iconDimensions.width;
		var ICON_HEIGHT = iconDimensions.height;

		var markers = [];

		// for each point,
		// find the absolute pixel coordinates for the given zoom level
		// assuming we're center aligning the point,
		// find the point's bounding box in pixel coordinates
		var byLat = data.sort(function (a, b) {
			return b['Latitude'] - a['Latitude'];
		});
		var byLng = data.sort(function (a, b) {
			return a['Longitude'] - b['Longitude'];
		});
		var byAmount = data.sort(function (a, b) {
			return b['Amount'] - a['Amount'];
		});

		byAmount.map(function (point, index) {
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

			// overlaps = false;
			// if it doesn't overlap, add to markers layer
			if (!overlaps) {

				var hex = getHexFromAmount(point['Amount']);

				if (hex) {
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
			}
		});

		if (markersLayer) {
			map.removeLayer(markersLayer);
		}

		markersLayer = L.layerGroup(markers);

		markersLayer.addTo(map);
	};

	var getMax = function getMax(arr) {
		return arr.reduce(function (previous, current) {
			return current['Amount'] > previous ? current['Amount'] : previous;
		}, 0);
	};

	var getHexFromAmount = function getHexFromAmount(amount) {
		var filtered = scale.filter(function (el) {
			return amount >= el.amount;
		});
		if (filtered.length) {
			return filtered[filtered.length - 1].hex;
		}
		return null;
	};

	window.snowfall_scraper = function (response) {
		var dataset = 'climate';
		var updated = new Date(response.updated);

		var timeString = updated.toLocaleTimeString();
		var timeSplit = timeString.split(':');
		var ampm = timeSplit[2].split(' ');

		var updatedString = updated.toLocaleDateString() + ' ' + timeSplit[0] + ':' + timeSplit[1] + ' ' + ampm[1];
		document.querySelector('.updated').textContent = 'Last updated ' + updatedString;

		data = response[dataset].map(function (el) {
			el['Latitude'] = parseFloat(el['Latitude']);
			el['Longitude'] = parseFloat(el['Longitude']);
			el['Amount'] = parseFloat(el['Amount']);
			return el;
		});

		addMarkersToMap(map.getZoom());
	};

	// run code
	init();
})();
