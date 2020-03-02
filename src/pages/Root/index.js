import React, { useState, useEffect } from "react";
import { useParams, Link, useHistory, useLocation } from "react-router-dom";
import ReactMapGL, { Source, Layer } from "react-map-gl";
import { range, descending } from "d3-array";
import { scaleQuantile } from "d3-scale";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Slider from "@material-ui/core/Slider";
import { useDebouncedCallback } from "use-debounce";

import {
	SITE_NAME,
	MAPBOX_TOKEN,
	COLOR_STOPS,
	MIN_YEAR,
	MAX_YEAR,
	isProd
} from "../../consts";
import styles from "./root.css";
import { parseJSON, getIntOrdinal } from "../../utils";

function useQuery() {
	return new URLSearchParams(useLocation().search);
}

// const dataLayer = {
// 	id: "data",
// 	type: "fill",
// 	paint: {
// 		"fill-color": {
// 			property: "emissionPercentile",
// 			stops: [
// 				[0, "#ffffff"],
// 				[1, "#f2fdff"],
// 				[2, "#d8f9ff"],
// 				[3, "#aee8fe"],
// 				[4, "#8ecefc"],
// 				[5, "#639df1"],
// 				[6, "#4c78d9"],
// 				[7, "#3657b6"],
// 				[8, "#16234d"]
// 			]
// 		},
// 		"fill-opacity": 0.8
// 	}
// };

const dataLayer = {
	id: "data",
	type: "fill",
	paint: {
		"fill-color": {
			property: "emissionPercentile",
			stops: [
				[-1, "black"],
				[0, "#D9E6FF"],
				[1, "#CDDAF6"],
				[2, "#C2CEED"],
				[3, "#B6C2E4"],
				[4, "#ABB7DB"],
				[5, "#9FABD2"],
				[6, "#949FC9"],
				[7, "#8993C1"],
				[8, "#7D88B8"],
				[9, "#727CAF"],
				[10, "#6670A6"],
				[11, "#5B649D"],
				[12, "#4F5994"],
				[13, "#444D8C"],
				[14, "#394183"],
				[15, "#2D357A"],
				[16, "#222A71"],
				[17, "#161E68"],
				[18, "#0B125F"],
				[19, "#000757"]
			]
		},
		"fill-opacity": 0.8
	}
};

function getPercentile(percentile, COLOR_STOPS) {
	return parseInt((percentile / (COLOR_STOPS - 1)) * 100);
}

function getRank(rank) {
	if (!rank) return "No data.";

	return (
		<span>
			<span>{rank}</span>
			<sup>{getIntOrdinal(rank)}</sup>
		</span>
	);
}

const Percentile = ({ hoveredFeature }) => {
	const percentile =
		getPercentile(
			hoveredFeature.feature.properties.emissionPercentile,
			COLOR_STOPS
		) || "No data.";

	return (
		<span>
			<span>Percentile: </span>
			<span>{percentile}</span>
		</span>
	);
};

function HoverPopup({ hoveredFeature, year }) {
	if (!hoveredFeature || !hoveredFeature.feature) {
		return null;
	}

	const featureEmissions = parseJSON(
		hoveredFeature.feature.properties.emissions
	);

	return (
		<div
			className={styles.tooltip}
			style={{
				left: hoveredFeature.x + 20,
				top: hoveredFeature.y + 20
			}}
		>
			<div>
				{hoveredFeature.feature.properties.name} ({year})
			</div>
			<div>
				{`Methane emissions: ${featureEmissions[year] ||
					"No data."} (kt of CO2 equivalent)`}
			</div>
			<Percentile hoveredFeature={hoveredFeature} />
			<div>
				<span>{`Country Rank: `}</span>
				{getRank(hoveredFeature.feature.properties.rank)}
			</div>
		</div>
	);
}

function YearSliderThumb(props) {
	const { children } = props;

	return (
		<span className={styles.yearSliderThumb} {...props}>
			{children}
		</span>
	);
}

const Root = ({ breakpoint }) => {
	let history = useHistory();
	let { year: yearInURL } = useParams();
	const [viewState, setViewState] = useState({
		latitude: 30,
		longitude: -10,
		zoom: 1.4,
		bearing: 0,
		pitch: 0
	});
	const [emissionFeatures, setEmissionFeatures] = useState([]);
	const [year, setYear] = useState(1970);
	const [hoveredFeature, setHoveredFeature] = useState({});
	let query = useQuery();
	const [debouncedUpdateSelfUrl] = useDebouncedCallback(updateSelfUrl, 50);

	const { latitude, longitude, zoom } = viewState;

	function init() {
		async function fetchEmissions() {
			const dataURL = isProd ? "/a/methane-emissions/data/country-emissions.geo.json" : "/data/country-emissions.geo.json";
			const emissions = await fetch(dataURL);
			const emissionsJSON = await emissions.json();

			setEmissionFeatures(emissionsJSON.features);
		}
		fetchEmissions();

		if (yearInURL) {
			setYear(yearInURL);
		}

		const lat = parseFloat(query.get("lat"));
		const lng = parseFloat(query.get("lng"));
		const zoom = parseFloat(query.get("zoom"));

		if (lat && lng && zoom) {
			setViewState({
				...viewState,
				latitude: lat,
				longitude: lng,
				zoom
			});
		}

		document.title = SITE_NAME;
	}
	useEffect(init, []);

	function updateSelfUrl(newUrl) {
		history.replace(newUrl);
	}

	function updateFeaturesForYear() {
		const scale = scaleQuantile()
			.domain(
				emissionFeatures.map(
					feature => feature.properties.emissions[year]
				)
			)
			.range(range(COLOR_STOPS));

		const rankings = emissionFeatures
			.map(feature => feature.properties.emissions[year])
			.filter(val => val !== "")
			.sort((a, b) => parseFloat(b) - parseFloat(a));

		const updatedFeatures = emissionFeatures.map(feature => {
			return {
				...feature,
				properties: {
					...feature.properties,
					emissionPercentile: scale(
						feature.properties.emissions[year]
					),
					rank:
						rankings.indexOf(feature.properties.emissions[year]) + 1
				}
			};
		});

		setEmissionFeatures(updatedFeatures);

		// Update if year changes while hovering (e.g. keyboard arrow interaction).
		if (hoveredFeature.feature) {
			const emissions = parseJSON(
				hoveredFeature.feature.properties.emissions
			);

			setHoveredFeature({
				...hoveredFeature,
				feature: {
					...hoveredFeature.feature,
					properties: {
						...hoveredFeature.feature.properties,
						emissionPercentile: scale(emissions[year]),
						rank: rankings.indexOf(emissions[year]) + 1
					}
				}
			});
		}
	}

	useEffect(updateFeaturesForYear, [year, emissionFeatures.length]);

	const geoJSONData = {
		type: "FeatureCollection",
		features: emissionFeatures
	};

	function handleYearChange(event, year) {
		setYear(year);

		updateSelfUrl(
			`/year/${year}?lat=${latitude}&lng=${longitude}&zoom=${zoom}`
		);
	}

	function handleHover(event) {
		const {
			features,
			srcEvent: { offsetX, offsetY }
		} = event;

		const feature = features && features.find(f => f.layer.id === "data");

		setHoveredFeature({ feature, x: offsetX, y: offsetY });
	}

	function handleMouseOut() {
		setHoveredFeature({});
	}

	function handleViewStateChange({ viewState }) {
		setViewState(viewState);

		debouncedUpdateSelfUrl(
			`/year/${year}?lat=${latitude}&lng=${longitude}&zoom=${zoom}`
		);
	}

	const marks = [
		{
			value: 1970,
			label: "1970"
		},
		{
			value: 1980,
			label: "1980"
		},
		{
			value: 1990,
			label: "1990"
		},
		{
			value: 2000,
			label: "2000"
		},
		{
			value: 2010,
			label: "2010"
		}
	];

	return (
		<div className={styles.container}>
			<div className={styles.yearSliderContainer}>
				<Slider
					value={year}
					aria-labelledby="discrete-slider"
					step={1}
					marks={marks}
					min={MIN_YEAR}
					max={MAX_YEAR}
					onChange={handleYearChange}
					valueLabelDisplay="on"
				/>
			</div>
			<ReactMapGL
				{...viewState}
				width="100%"
				height="100%"
				mapStyle="mapbox://styles/mapbox/light-v9"
				mapboxApiAccessToken={MAPBOX_TOKEN}
				onViewStateChange={handleViewStateChange}
				onHover={handleHover}
				onMouseOut={handleMouseOut}
			>
				<Source type="geojson" data={geoJSONData}>
					<Layer {...dataLayer} />
				</Source>
			</ReactMapGL>
			<HoverPopup hoveredFeature={hoveredFeature} year={year} />
		</div>
	);
};

export default Root;
