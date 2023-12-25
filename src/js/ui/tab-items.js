/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>
	License: MIT
 */
const core = require('../core');
const fs = require('fs');
const listfile = require('../casc/listfile');
const MultiMap = require('../MultiMap');

const DBModelFileData = require('../db/caches/DBModelFileData');
const DBTextureFileData = require('../db/caches/DBTextureFileData');

const WDCReader = require('../db/WDCReader');
const ItemSlot = require('../wow/ItemSlot');

const M2Loader = require('../3D/loaders/M2Loader');
const BLPFile = require('../casc/blp');

const ITEM_SLOTS_IGNORED = [0, 18, 11, 12, 24, 25, 27, 28];

const ITEM_SLOTS_MERGED = {
	'Head': [1],
	'Neck': [2],
	'Shoulder': [3],
	'Shirt': [4],
	'Chest': [5, 20],
	'Waist': [6],
	'Legs': [7],
	'Feet': [8],
	'Wrist': [9],
	'Hands': [10],
	'One-hand': [13],
	'Off-hand': [14, 22, 23],
	'Two-hand': [17],
	'Main-hand': [21],
	'Ranged': [15, 26],
	'Back': [16],
	'Tabard': [19]
};

class Item {
	/**
	 * Construct a new Item instance.
	 * @param {number} id 
	 * @param {object} itemSparseRow 
	 * @param {?object} itemAppearanceRow
	 * @param {?Array} textures
	 * @param {?Array} models
	 */
	constructor(id, itemSparseRow, itemAppearanceRow, textures, models) {
		this.id = id;
		this.name = itemSparseRow.Display_lang;
		this.inventoryType = itemSparseRow.InventoryType;
		this.quality = itemSparseRow.OverallQualityID;

		this.icon = itemAppearanceRow?.DefaultIconFileDataID ?? 0;

		this.models = models;
		this.textures = textures;

		this.modelCount = this.models?.length ?? 0;
		this.textureCount = this.textures?.length ?? 0;
	}

	/**
	 * Returns item slot name for this items inventory type.
	 * @returns {string}
	 */
	get itemSlotName() {
		return ItemSlot.getSlotName(this.inventoryType);
	}

	/**
	 * Returns the display name for this item entry.
	 */
	get displayName() {
		return this.name + ' (' + this.id + ')';
	}
}

/**
 * Switches to the model viewer, selecting the models for the given item.
 * @param {object} item 
 */
const viewItemModels = (item) => {
	core.view.setScreen('tab-models');

	const list = new Set();

	for (const modelID of item.models) {
		const fileDataIDs = DBModelFileData.getModelFileDataID(modelID);
		for (const fileDataID of fileDataIDs) {
			let entry = listfile.getByID(fileDataID);

			if (entry !== undefined) {
				if (core.view.config.listfileShowFileDataIDs)
					entry += ' [' + fileDataID + ']';

				list.add(entry);
			}
		}
	}

	// Reset the user filter for models.
	core.view.userInputFilterModels = '';

	core.view.overrideModelList = [...list];
	core.view.selectionModels = [...list];
	core.view.overrideModelName = item.name;
};

/**
 * Switches to the texture viewer, selecting the models for the given item.
 * @param {object} item 
 */
const viewItemTextures = (item) => {
	core.view.setScreen('tab-textures');

	const list = new Set();

	for (const textureID of item.textures) {
		const fileDataID = DBTextureFileData.getTextureFileDataID(textureID);
		let entry = listfile.getByID(fileDataID);

		if (entry !== undefined) {
			if (core.view.config.listfileShowFileDataIDs)
				entry += ' [' + fileDataID + ']';

			list.add(entry);
		}
	}

	// Reset the user filter for textures.
	core.view.userInputFilterTextures = '';

	core.view.overrideTextureList = [...list];
	core.view.selectionTextures = [...list];
	core.view.overrideTextureName = item.name;
};

core.events.once('screen-tab-items', async () => {
	// Initialize a loading screen.
	const progress = core.createProgress(5);
	core.view.setScreen('loading');
	core.view.isBusy++;

	await progress.step('Loading item data...');
	const itemSparse = new WDCReader('DBFilesClient/ItemSparse.db2');
	await itemSparse.parse();

	console.log(itemSparse)

	await progress.step('Loading item display info...');
	const itemDisplayInfo = new WDCReader('DBFilesClient/ItemDisplayInfo.db2');
	await itemDisplayInfo.parse();

	console.log(itemDisplayInfo)

	await progress.step('Loading item appearances...');
	const itemModifiedAppearance = new WDCReader('DBFilesClient/ItemModifiedAppearance.db2');
	await itemModifiedAppearance.parse();

	console.log(itemModifiedAppearance)

	await progress.step('Loading item materials...');
	const itemDisplayInfoMaterialRes = new WDCReader('DBFilesClient/ItemDisplayInfoMaterialRes.db2');
	await itemDisplayInfoMaterialRes.parse();

	await progress.step('Loading item helmet geoset vis...');
	const HelmetGeosetData = new WDCReader('DBFilesClient/HelmetGeosetData.db2');
	await HelmetGeosetData.parse();

	console.log('HelmetGeosetData', HelmetGeosetData)
	console.log(itemDisplayInfoMaterialRes)

	const itemAppearance = new WDCReader('DBFilesClient/ItemAppearance.db2');
	await itemAppearance.parse();

	console.log(itemAppearance)


	await progress.step('Building item relationships...');

	const rows = itemSparse.getAllRows();
	const items = [];

	const exportItems = [];

	const appearanceMap = new Map();
	for (const row of itemModifiedAppearance.getAllRows().values()) {
		appearanceMap.set(row.ItemID, row.ItemAppearanceID);
		if (row.ItemID === 22428) {
			console.log('redemption: ', row)
		}
	}

	const materialMap = new MultiMap();
	const materialDataMap = new MultiMap();
	for (const row of itemDisplayInfoMaterialRes.getAllRows().values()) {
		if (row.ItemDisplayInfoID === 36972) {
			console.log('redemption itemDisplayInfoMaterialRes', row)
		}
		materialMap.set(row.ItemDisplayInfoID, row.MaterialResourcesID);
		materialDataMap.set(row.ItemDisplayInfoID, row)
	}


	for (const [itemID, itemRow] of rows) {
		if (ITEM_SLOTS_IGNORED.includes(itemRow.inventoryType))
			continue;

		const itemAppearanceID = appearanceMap.get(itemID);
		const itemAppearanceRow = itemAppearance.getRow(itemAppearanceID);

		if (itemID === 22428) {
			console.log('redemption itemAppearanceRow: ', itemAppearanceRow)
		}

		let materials = null;
		let models = null;
		let modelData;
		let textureData;
		let displayInfo;
		if (itemAppearanceRow !== null) {
			materials = [];
			models = [];

			const itemDisplayInfoRow = itemDisplayInfo.getRow(itemAppearanceRow.ItemDisplayInfoID);
			if (itemID === 22428) {
				console.log('redemption itemDisplayInfoRow: ', itemDisplayInfoRow)
			}
			if (itemDisplayInfoRow !== null) {
				materials.push(...itemDisplayInfoRow.ModelMaterialResourcesID);
				models.push(...itemDisplayInfoRow.ModelResourcesID);
				displayInfo = itemDisplayInfoRow
			}

			const materialRes = materialMap.get(itemAppearanceRow.ItemDisplayInfoID);
			let materialData = materialDataMap.get(itemAppearanceRow.ItemDisplayInfoID)
			if (itemID === 22428) {
				console.log('redemption materialRes: ', materialRes)
			}
			if (materialRes !== undefined)
				Array.isArray(materialRes) ? materials.push(...materialRes) : materials.push(materialRes);

			materials = materials.filter(e => e !== 0);
			models = models.filter(e => e !== 0);


			const modelList = {}
			for (const modelID of models) {
				const fileDataIDs = DBModelFileData.getModelFileDataID(modelID);
				for (const fileDataID of fileDataIDs) {
					let entry = listfile.getByID(fileDataID);

					const file = await core.view.casc.getFile(fileDataID);
					let m2 = new M2Loader(file);
					if (itemID === 22428) {
						console.log('redemption m2: ', m2)
					}
					await m2.load();
					if (entry !== undefined) {
						if (core.view.config.listfileShowFileDataIDs)
							entry += ' [' + fileDataID + ']';

						let skins = []

						for (let i = 0; i < m2.skins.length; i++) {
							const skin = await m2.getSkin(i)
							skins.push(skin)
						}

						//console.log('skins', skins)

						//need to parse out textures here

						let textures = []
						for (let i = 0; i < m2.textures.length; i++) {
							const texture = m2.textures[i]
							if (!texture?.fileDataID) {
								textures.push({
									id: texture?.fileDataID,
									flags: texture?.flags,
								})
								continue
							}
							let entry = listfile.getByID(texture.fileDataID);

							const file = await core.view.casc.getFile(texture.fileDataID);
							let tex = new BLPFile(file)
							let png = tex.toPNG();
							let base64 = png.toBase64();
							if (entry !== undefined) {
								if (core.view.config.listfileShowFileDataIDs)
									entry += ' [' + texture?.fileDataID + ']';

								textures.push({
									id: texture?.fileDataID,
									filename: entry,
									texture: base64,
									flags: texture?.flags,
								})
							}
						}

						modelList[fileDataID] = {
							filename: entry,
							bones: m2.bones,
							vertices: m2.vertices,
							normals: m2.normals,
							uv: m2.uv,
							uv2: m2.uv2,
							boneWeights: m2.boneWeights,
							boneIndices: m2.boneIndices,
							colors: m2.colors,
							textures: textures,
							textureTypes: m2.textureTypes,
							textureWeights: m2.textureWeights,
							textureTransforms: m2.textureTransforms,
							replaceableTextureLookup: m2.replaceableTextureLookup,
							materials: m2.materials,
							textureCombos: m2.textureCombos,
							transparencyLookup: m2.transparencyLookup,
							textureTransformsLookup: m2.textureTransformsLookup,
							attachments: m2.attachments,
							skins: skins,
							animations: m2.animations,
						}
					}
				}
			}
			modelData = modelList

			const textureList = []

			

			//console.log(materials, materialData, materialDataMap)

			if (materialData && !Array.isArray(materialData)) materialData = [materialData]
			for (const textureID of materials) {
				let ComponentSection
				materialData?.forEach(mat => {
					if (mat.MaterialResourcesID === textureID)
						ComponentSection = mat.ComponentSection
				})
				//const mat = materialDataMap[textureID]
				//console.log(textureID, materialData)


				const fileDataID = DBTextureFileData.getTextureFileDataID(textureID);

				if (itemID === 22428) {
					console.log('redemption textureID: ', textureID, fileDataID)
				}

				//console.log('material texture id', textureID, fileDataID)
				let entry = listfile.getByID(fileDataID);



				//const file = await core.view.casc.getFile(fileDataID);
				const file = await core.view.casc.getFileByName(entry)
				let tex = new BLPFile(file)
				let png = tex.toPNG();
				let base64 = png.toBase64();
				textureList.push({
					id: fileDataID,
					gender: entry.endsWith('_m.blp') ? 'MALE' : undefined,
					ComponentSection: ComponentSection,
					filename: entry,
					texture: base64,
				})

				if (entry.endsWith('_m.blp')) {
					const femaleFilename = entry.replace('_m.blp', '_f.blp')
					const femaleID = listfile.getByFilename(femaleFilename)
					if (itemID === 22428) {
						console.log('redemption female id', femaleID)
					}
					if (femaleID) {
						const file = await core.view.casc.getFileByName(femaleFilename)
						let tex = new BLPFile(file)
						let png = tex.toPNG();
						let base64 = png.toBase64();

						if (itemID === 22428) {
							console.log('redemption file id', file)
						}
						textureList.push({
							id: femaleID,
							gender: 'FEMALE',
							ComponentSection: ComponentSection,
							filename: femaleFilename,
							texture: base64,
						})
					}

				}
			}


			textureData = textureList
		}

		items.push(Object.freeze(new Item(itemID, itemRow, itemAppearanceRow, materials, models)));

		itemExport = new Item(itemID, itemRow, itemAppearanceRow, materials, models);

		let itemJSON = {
			id: itemExport.id,
			name: itemExport.name,
			inventoryType: itemExport.inventoryType,
			quality: itemExport.quality,
			icon: itemExport.icon,
			models: modelData,
			displayInfo: displayInfo,
			itemLevel: itemRow.ItemLevel,
			textures: textureData,
		}

		if (itemID === 22428) {
			console.log('redemption json', itemJSON)
		}
		//console.log(itemJSON)

		if (itemJSON?.displayInfo)
			fs.writeFileSync(`C:\\Users\\cozze\\Downloads\\wow.export-0.1.54\\out\\${itemID}.json`, JSON.stringify(itemJSON), err => {
				if (err) console.error(err)
			})

		exportItems.push({ ...itemExport, modelData: modelData, textureData: textureData });
	}

	//console.log(exportItems)

	// Show the item viewer screen.
	core.view.loadPct = -1;
	core.view.isBusy--;
	core.view.setScreen('tab-items');

	// Load initial configuration for the type control from config.
	const enabledTypes = core.view.config.itemViewerEnabledTypes;
	const mask = [];

	for (const label of Object.keys(ITEM_SLOTS_MERGED))
		mask.push({ label, checked: enabledTypes.includes(label) });

	// Register a watcher for the item type control.
	core.view.$watch('itemViewerTypeMask', () => {
		// Refilter the listfile based on what the new selection.
		const filter = core.view.itemViewerTypeMask.filter(e => e.checked);
		const mask = [];

		filter.forEach(e => mask.push(...ITEM_SLOTS_MERGED[e.label]));
		const test = items.filter(item => mask.includes(item.inventoryType));
		core.view.listfileItems = test;

		// Save just the names of user enabled types, preventing incompatibilities if we change things.
		core.view.config.itemViewerEnabledTypes = core.view.itemViewerTypeMask.map(e => e.label);
	}, { deep: true });

	core.view.itemViewerTypeMask = mask;
});

module.exports = { viewItemModels, viewItemTextures };