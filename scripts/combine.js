import { promises as fs } from "fs";
import util from "util";
import parseCSV from "csv-parse";

const { readFile, writeFile } = fs;

const emissionsCSV = "API_EN.ATM.METH.KT.CE_DS2_en_csv_v2_823144.csv";
const countriesGeoJSON = "countries.geo.json";
const outputFilename = "../src/data/country-emissions.geo.json";

function parseJSON(text) {
	let json = null;

	try {
		json = JSON.parse(text);
	} catch (e) {
		throw new Error("Error parsing JSON.");
	}

	return json;
}

function yearArrToObj(years) {
	return years.reduce((accum, yearEmissions, index) => {
		accum[1960 + index] = yearEmissions;

		return accum;
	}, {});
}

function findMissingCountries(countries, emissions) {
	const missingCountryCodes = emissions.reduce((accum, {country}) => {
		if (!countries.features.find(({ id }) => country === id)) {
			accum.push(country);

		}
		return accum;
	}, []);

	console.log(222, `${missingCountryCodes.length} countries missing GeoJSON`, missingCountryCodes);
}


async function mergeAllEmissionsWithCountry() {
	const countriesRaw = await readFile(`./${countriesGeoJSON}`, "utf8");
	const countries = parseJSON(countriesRaw);

	const emissionsRaw = await readFile(`./${emissionsCSV}`, "utf8");

	parseCSV(emissionsRaw, { relax: true}, async function(err, countryEmissions) {
		const emissions = countryEmissions.map(([countryName, countryCode, , , ...years]) => {
			return {
				country: countryCode,
				years: yearArrToObj(years)
			}
		});

		findMissingCountries(countries, emissions);

		// Merge emissions with country GeoJSON
		const featuresWithEmissions = countries.features.reduce((features, feature) => {
			const emissionsForCountry = emissions.find(({ country }) => country === feature.id);

			if (emissionsForCountry) {
				features.push({
					...feature,
					properties: {
						...feature.properties,
						emissions: emissionsForCountry.years
					}
				})
			} else {
				console.warn(`Could not find emissions for ${ feature.id }`);
			}

			return features;
		}, []);

		// Write output to file.
		const output = {
			type: "FeatureCollection",
			features: featuresWithEmissions
		}
		await writeFile(outputFilename, JSON.stringify(output, null, 2));
	});
}

mergeAllEmissionsWithCountry();
