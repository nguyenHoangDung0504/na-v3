// Import components
import { waitIncludeQueueEmpty } from '../@components/html-include/index.js'

import { debugMode as decoratorDebug } from '../@libraries/decorators/index.mjs'
import { database } from './database/index.mjs'

const path = location.pathname
if (location.href.includes('127.0.0.1')) localStorage.setItem('dev-mode', '1')

const isHomePage = () => ['/', '/index.html'].includes(path)
const isWatchPage = () => ['/watch/index.html', '/watch/'].includes(path)
const isPlayerPage = () => ['/watch/player/index.html', '/watch/player/'].includes(path)

let UIrequests = {
	common: isHomePage() || isWatchPage() ? loadCommonUI() : null,
	home: isHomePage() ? loadHomeUI() : null,
	watch: isWatchPage() ? loadWatchUI() : null,
	player: isPlayerPage() ? loadPlayerUI() : null,
}

database.export()
initApp().catch((error) => {
	alert('Something is wrong, try reloading.')
	throw error
})

async function initApp() {
	const DEBUG_MODE = debugMode(false)
	decoratorDebug(DEBUG_MODE)
	activateTimer()

	await Promise.all([DOMLoaded(), waitIncludeQueueEmpty(), ...Object.values(UIrequests).filter(Boolean)])
	await Promise.all([
		UIrequests.common && (await UIrequests.common).init(database),
		UIrequests.home && (await UIrequests.home).init(database),
		UIrequests.watch && (await UIrequests.watch).init(database),
		UIrequests.player && (await UIrequests.player).init(database),
	])

	console.timeEnd('--> [App.timer]: App ready time')
}

function activateTimer() {
	console.time('--> [App.timer]: DOM ready time')
	console.time('--> [App.timer]: App ready time')
	console.time('--> [App.timer]: App load time')
	window.addEventListener('load', () => console.timeEnd('--> [App.timer]: App load time'))
}

async function DOMLoaded() {
	return new Promise((resolve) => {
		const callback = () => {
			console.timeEnd('--> [App.timer]: DOM ready time')
			resolve()
		}
		if (document.readyState !== 'loading') callback()
		else document.addEventListener('DOMContentLoaded', callback, { once: true })
	})
}

function debugMode(on = false) {
	if (!on) return on

	const originalEncodeURIComponent = window.encodeURIComponent
	window.encodeURIComponent = (uri) => {
		const encodedURI = originalEncodeURIComponent(uri)
		console.log(`--> [Debugger]: Encoded URI: ${uri} --> ${encodedURI}`)
		return encodedURI
	}

	return on
}

async function loadCommonUI() {
	return import('./UIs/common.mjs')
}

async function loadHomeUI() {
	return import('./UIs/home.mjs')
}

async function loadWatchUI() {
	return import('./UIs/watch.mjs')
}

async function loadPlayerUI() {
	return import('./UIs/player.mjs')
}
