const htmlCache = new Map()
const cssLinkCache = new Set()
let includePromises = []

export async function waitIncludeQueueEmpty() {
	const awaited = await Promise.all(includePromises)
	console.log(`> [Component.HTMLInclude] Awaited ${awaited.length} components:`, awaited)
	includePromises = includePromises.filter(Boolean)

	return awaited
}

export default class HtmlInclude extends HTMLElement {
	async connectedCallback() {
		const src = this.getAttribute('src')
		if (src) includePromises.push(this._process(src))
	}

	/**
	 * @private
	 * @param {string} src
	 */
	async _process(src) {
		const cssFile = this.getAttribute('css')

		try {
			const htmlUrl = resolveHtmlPath(src)
			const html = await loadHtml(htmlUrl)

			const cssUrl = resolveCssPath(src, cssFile)

			if (cssUrl) {
				const id = normalizeId(cssUrl)
				if (!cssLinkCache.has(id)) {
					if (!document.getElementById(id)) {
						const link = document.createElement('link')
						link.id = id
						link.rel = 'stylesheet'
						link.href = cssUrl
						document.head.appendChild(link)
					}
					cssLinkCache.add(id)
				}
			}

			const template = document.createElement('template')
			template.innerHTML = html.trim()
			this.replaceWith(template.content)
		} catch (err) {
			console.error(`Failed to load ${src}:`, err)
			this.innerHTML = `<!-- Error loading ${src} -->`
		}

		return src
	}
}

function normalizeId(path) {
	return 'include-css-' + btoa(path).replace(/=+/g, '')
}

function isHtmlFile(path) {
	return /\/?[^/]+\.[a-z0-9]+$/i.test(path)
}

function resolveHtmlPath(src) {
	if (isHtmlFile(src)) return src
	return src.replace(/\/$/, '') + '/index.html'
}

function resolveCssPath(src, cssFile) {
	if (cssFile === 'none') return null
	const root = isHtmlFile(src) ? src.replace(/\/[^/]+$/, '') : src.replace(/\/$/, '')
	return `${root}/${cssFile || 'style.css'}`
}

async function loadHtml(url) {
	if (htmlCache.has(url)) return htmlCache.get(url)

	const res = await fetch(url)
	if (!res.ok) throw new Error(res.status)

	const html = await res.text()
	htmlCache.set(url, html)
	return html
}

customElements.define('html-i', HtmlInclude)
