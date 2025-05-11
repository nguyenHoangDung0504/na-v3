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
	 * @param {string} RJcode
	 * @param {string} eName
	 * @param {string} jName
	 */
	constructor(RJcode, eName, jName) {
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
	 * @param {string} name
	 * @param {number} quantity
	 */
	constructor(type, name, quantity) {
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
	/**
	 * @param {string} prefixID
	 * @param {string} name
	 */
	constructor(prefixID, name) {
		this.prefixID = Number(prefixID);
		this.name = name;
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
		this.images = images;
		this.audios = audios;
	}

	/**
	 * @param {boolean} option
	 */
	checkURLError(option) {
		if (option === true) {
			tryURL(this.thumbnail);
			this.images.forEach((url) => tryURL(url));
			this.audios.forEach((url) => tryURL(url));
		}
		return this;
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

	/**
	 * @param {boolean} option
	 */
	checkURLError(option) {
		if (option === true) {
			tryURL(this.url);
		}
		return this;
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
	 * @param {number} id
	 */
	constructor(type, value, keyword, id) {
		this.type = type;
		this.displayType = SearchSuggestion.typeToDisplay[type];
		this.value = value;
		this.keyword = keyword;
		this.code = id;
	}
}

function tryURL(urlString) {
	try {
		new URL(urlString);
	} catch (error) {
		console.error(error);
		console.log('Error url:', urlString);
	}
}
