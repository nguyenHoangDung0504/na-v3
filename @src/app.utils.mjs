/**
 * @typedef {{ name: string }} NamedEntity
 * @typedef {{ quantity: number }} QuantifiableEntity
 * @typedef {{
 * 		keyword: string
 * 		type: 'code' | 'RJcode' | 'cv' | 'tag' | 'series' | 'eName' | 'jName'
 * 		value: string | number
 * }} Suggestion
 */

export const url = {
	/**
	 * @param {string} key
	 * @param {string} value
	 * @param {URL} url
	 */
	setParam(key, value, url = new URL(window.location.href)) {
		url.searchParams.set(key, value)
		return url.toString()
	},

	/**
	 * @param {string} key
	 * @param {URLSearchParams} searchParams
	 */
	getParam(key, searchParams = new URLSearchParams(location.search)) {
		return searchParams.get(key)
	},

	/**
	 * @param {string} url
	 */
	getFileNameFromUrl(url) {
		return decodeURIComponent(
			url.slice(url.lastIndexOf('/') + 1, url.includes('?') ? url.lastIndexOf('?') : url.length),
		)
	},
}

export const array = {
	/**
	 * @param {any[]} array
	 */
	shuffle(array) {
		let currentIndex = array.length
		while (currentIndex > 0) {
			let randomIndex = Math.floor(Math.random() * currentIndex--)
			;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
		}
		return array
	},

	/**
	 * @template T
	 * @param {T[]} arr
	 * @param {keyof T} key
	 */
	deduplicateObjects(arr, key) {
		const map = new Map()

		return arr.filter((obj) => {
			const keyValue = obj[key]
			if (map.has(keyValue)) return false
			map.set(keyValue, true)
			return true
		})
	},
}

export const device = {
	isMobile() {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
	},
}

export const fullscreen = {
	activate() {
		const elem = document.documentElement
		elem.requestFullscreen?.() || elem.webkitRequestFullscreen?.() || elem.msRequestFullscreen?.()
	},

	deactivate() {
		if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) return
		document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.()
	},

	toggle() {
		document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement
			? this.deactivate()
			: this.activate()
	},
}

export const sort = {
	/**
	 * @param {NamedEntity} a
	 * @param {NamedEntity} b
	 * @returns {number}
	 */
	byName(a, b) {
		return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
	},

	/**
	 * @param {QuantifiableEntity} a
	 * @param {QuantifiableEntity} b
	 * @returns {number}
	 */
	byQuantity(a, b) {
		return a.quantity - b.quantity
	},

	/**
	 * @param {Suggestion} a
	 * @param {Suggestion} b
	 * @returns {number}
	 */
	bySuggestionRelevance(a, b) {
		const typeOrder = ['code', 'RJcode', 'cv', 'tag', 'series', 'eName', 'jName']
		const keywordIndexA = a.value.toString().toLowerCase().indexOf(a.keyword)
		const keywordIndexB = b.value.toString().toLowerCase().indexOf(b.keyword)

		if (keywordIndexA !== keywordIndexB) return keywordIndexA - keywordIndexB

		const typeComparison = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
		if (typeComparison !== 0) return typeComparison

		return a.value.toString().localeCompare(b.value.toString())
	},
}

export const highlight = {
	/**
	 * @param {string} text
	 * @param {string} highlightValue
	 */
	apply(text, highlightValue) {
		let regexp = new RegExp(highlightValue, 'i')
		return text.toString().replace(regexp, `<span class="highlight">$&</span>`)
	},

	/**
	 * @param {string} text
	 */
	revoke(text) {
		let regex = /<span class="highlight">([\s\S]*?)<\/span>/gi
		return text.toString().replace(regex, '$1')
	},
}

export const pager = {
	/**
	 * @param {number} currentPage
	 * @param {number} pagePerGroup
	 * @param {number} limitPage
	 */
	getGroupOfPagination(currentPage, pagePerGroup, limitPage) {
		// Giới hạn `pagePerGroup` không vượt quá `limitPage`
		pagePerGroup = Math.min(pagePerGroup, limitPage)

		// Tính toán phạm vi startPage - endPage
		let startPage = Math.max(1, currentPage - Math.floor((pagePerGroup - 1) / 2))
		let endPage = startPage + pagePerGroup - 1

		// Điều chỉnh khi `endPage` vượt quá `limitPage`
		if (endPage > limitPage) {
			endPage = limitPage
			startPage = Math.max(1, endPage - pagePerGroup + 1)
		}

		// Trả về mảng số trang
		return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
	},

	/**
	 * @param {number} page
	 * @param {number} recordsPerPage
	 * @param {number[]} IDs
	 */
	getTrackIDsForPage(page, recordsPerPage, IDs) {
		const start = (page - 1) * recordsPerPage
		const end = Math.min(start + recordsPerPage - 1, IDs.length)

		return IDs.slice(start, end + 1)
	},
}

export const string = {
	/**
	 * @param {string} string
	 */
	formatQuotes(string) {
		return (
			string
				// single quotes ’ and ‘ -> '
				.replace(/[‘’‛`´]/g, "'")
				// double quotes “ and ” -> "
				.replace(/[“”«»„‟]/g, '"')
		)
	},
}
