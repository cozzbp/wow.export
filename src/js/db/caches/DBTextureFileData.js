/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>, Martin Benjamins <marlamin@marlamin.com>
	License: MIT
 */

const log = require('../../log');
const WDCReader = require('../WDCReader');

const matResIDToFileDataID = new Map();
const fileDataIDs = new Set();

/**
 * Initialize texture file data ID from TextureFileData.db2
 */
const initializeTextureFileData = async () => {
	log.write('Loading texture mapping...');
	const textureFileData = new WDCReader('DBFilesClient/TextureFileData.db2');
	await textureFileData.parse();

	const ComponentTextureFileData = new WDCReader('DBFilesClient/ComponentTextureFileData.db2');
	await ComponentTextureFileData.parse();

	console.log('textureFileData', textureFileData)

	console.log('ComponentTextureFileData', ComponentTextureFileData)
	// Using the texture mapping, map all model fileDataIDs to used textures.
	for (const [textureFileDataID, textureFileDataRow] of textureFileData.getAllRows()) {
		// Keep a list of all FIDs for listfile unknowns.
		fileDataIDs.add(textureFileDataID);

		// TODO: Need to remap this to support other UsageTypes
		if (textureFileDataRow.UsageType !== 0)
		{
			console.log('usage type!', textureFileDataRow)
			continue;
		}
			

		
		matResIDToFileDataID.set(textureFileDataRow.MaterialResourcesID, textureFileDataID);
	}
	log.write('Loaded texture mapping for %d materials', matResIDToFileDataID.size);
};

/**
 * Retrieve a texture file data ID by a material resource ID.
 * @param {number} matResID 
 * @returns {?number}
 */
const getTextureFileDataID = (matResID) => {
	return matResIDToFileDataID.get(matResID);
};

/**
 * Retrieve a list of all file data IDs cached from TextureFileData.db2
 * NOTE: This is reset once called by the listfile module; adjust if needed elsewhere.
 * @returns {Set}
 */
const getFileDataIDs = () => {
	return fileDataIDs;
};

module.exports = {
	initializeTextureFileData,
	getTextureFileDataID,
	getFileDataIDs
};