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
   * Initialize texture file data ID from AnimationData.db2
   */
  const initializeAnimationData = async () => {
    log.write('Loading texture mapping...');
    const animationData = new WDCReader('DBFilesClient/AnimationData.db2');
    await animationData.parse();
  
    console.log('animationData', animationData)
  
    // Using the texture mapping, map all model fileDataIDs to used textures.
    for (const [animationDataID, animationDataRow] of animationData.getAllRows()) {
      // Keep a list of all FIDs for listfile unknowns.
      fileDataIDs.add(animationDataID);
      
      matResIDToFileDataID.set(animationDataRow.MaterialResourcesID, animationDataID);
    }
    log.write('Loaded component texture mapping for %d materials', matResIDToFileDataID.size);
  };
  
  /**
   * Retrieve a texture file data ID by a material resource ID.
   * @param {number} matResID 
   * @returns {?number}
   */
  const getAnimationDataID = (matResID) => {
    return matResIDToFileDataID.get(matResID);
  };
  
  /**
   * Retrieve a list of all file data IDs cached from AnimationData.db2
   * NOTE: This is reset once called by the listfile module; adjust if needed elsewhere.
   * @returns {Set}
   */
  const getFileDataIDs = () => {
    return fileDataIDs;
  };
  
  module.exports = {
    initializeAnimationData,
    getAnimationDataID,
    getFileDataIDs
  };