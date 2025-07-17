export class Track {
	/**
	 * @param {TrackInfo} info
	 * @param {TrackCategories} category
	 * @param {TrackResources} resource
	 * @param {AddtionalURL[]} additional
	 */
	constructor(info, category, resource, additional) {
		this.info = info;
		this.category = category;
		this.resource = resource;
		this.additional = additional;
	}
}

export class TrackInfo {
	/**
	 * @param {number} code
	 * @param {string} RJcode
	 * @param {string} eName
	 * @param {string} jName
	 */
	constructor(code, RJcode, eName, jName) {
		this.code = code;
		this.RJcode = RJcode;
		this.eName = eName;
		this.jName = jName;
	}
}

/**
 * @template {'cv' | 'tag' | 'series'} T
 */
export class Category {
	/**
	 * @param {T} type
	 * @param {number} id
	 * @param {string} name
	 * @param {number} quantity
	 */
	constructor(id, type, name, quantity) {
		this.id = id;
		this.type = type;
		this.name = name;
		this.quantity = quantity;
	}
}

export class TrackCategories {
	/**
	 * @param {number[]} cvIDs
	 * @param {number[]} tagIDs
	 * @param {number[]} seriesIDs
	 */
	constructor(cvIDs, tagIDs, seriesIDs) {
		this.cvIDs = cvIDs;
		this.tagIDs = tagIDs;
		this.seriesIDs = seriesIDs;
	}
}

export class Resource {
	constructor(prefixID, name) {
		this.prefixID = Number(prefixID);
		this.rawName = name;
	}

	get name() {
		return this.rawName;
	}
}

export class TrackResources {
	/**
	 * @param {Resource} thumbnail
	 * @param {Resource[]} images
	 * @param {Resource[]} audios
	 */
	constructor(thumbnail, images, audios) {
		this.thumbnail = thumbnail;
		this.thumbnail.rawName += '?type=main';
		this.images = images;
		this.audios = audios;
	}
}

export class AddtionalURL {
	/**
	 * @param {string} label
	 * @param {string} url
	 */
	constructor(label, url) {
		this.note = label;
		this.url = url;
	}
}

/**
 * @template {'code' | 'RJcode' | 'cv' | 'tag' | 'series' | 'eName' | 'jName'} T
 */
export class SearchSuggestion {
	static typeToDisplay = {
		code: 'Code',
		RJcode: 'RJ Code',
		cv: 'Cv',
		tag: 'Tag',
		series: 'Series',
		eName: 'Name',
		jName: 'Original Name',
	};

	/**
	 * @param {T} type
	 * @param {string} value
	 * @param {string} keyword
	 * @param {string | number} id
	 */
	constructor(type, value, keyword, id) {
		this.type = type;
		this.displayType = SearchSuggestion.typeToDisplay[type];
		this.value = value;
		this.keyword = keyword;
		this.code = id;
	}
}
