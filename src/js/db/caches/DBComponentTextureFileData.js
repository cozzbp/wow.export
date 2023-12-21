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
   * Initialize texture file data ID from ComponentTextureFileData.db2
   */
  const initializeComponentTextureFileData = async () => {
    log.write('Loading texture mapping...');
    const componentTextureFileData = new WDCReader('DBFilesClient/ComponentTextureFileData.db2');
    await componentTextureFileData.parse();
  
    console.log('componentTextureFileData', componentTextureFileData)
  
    // Using the texture mapping, map all model fileDataIDs to used textures.
    for (const [componentTextureFileDataID, componentTextureFileDataRow] of componentTextureFileData.getAllRows()) {
      // Keep a list of all FIDs for listfile unknowns.
      fileDataIDs.add(componentTextureFileDataID);
      
      matResIDToFileDataID.set(componentTextureFileDataRow.MaterialResourcesID, componentTextureFileDataID);
    }
    log.write('Loaded component texture mapping for %d materials', matResIDToFileDataID.size);
  };
  
  /**
   * Retrieve a texture file data ID by a material resource ID.
   * @param {number} matResID 
   * @returns {?number}
   */
  const getComponentTextureFileDataID = (matResID) => {
    return matResIDToFileDataID.get(matResID);
  };
  
  /**
   * Retrieve a list of all file data IDs cached from ComponentTextureFileData.db2
   * NOTE: This is reset once called by the listfile module; adjust if needed elsewhere.
   * @returns {Set}
   */
  const getFileDataIDs = () => {
    return fileDataIDs;
  };
  
  module.exports = {
    initializeComponentTextureFileData,
    getComponentTextureFileDataID,
    getFileDataIDs
  };