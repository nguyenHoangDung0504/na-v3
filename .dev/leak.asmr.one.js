window.leakURL = leakURL;

/**
 *
 * @param {string} type
 * @returns
 */
async function leakURL(type) {
	const path = document
		.querySelector('.flex.items-center.justify-start.q-gutter-xs')
		.textContent.split('/')
		.map((folder) => folder.split('\n')[1].trim())
		.filter((folder) => folder.toLowerCase() !== 'root');

	const codePart = new URL(window.location.href).pathname
		.split('/')
		.filter(Boolean)
		.pop()
		.slice(2);

	const manifest = await (
		await fetch(`https://api.asmr-200.com/api/tracks/${codePart}?v=1`)
	).json();
	console.log('Debug::Manifest:', manifest);

	const currentFolder = travelFolders(manifest, path);
	console.log('Debug::Current_Folder:', currentFolder);

	const result = currentFolder.children
		.map((c) => (c.type === type ? c.mediaStreamUrl : undefined))
		.filter(Boolean)
		.join(',');
	console.log('Debugg::Result:', result);

	return result;
}

/**
 * @param {[]} root
 * @param {string[]} path
 * @returns
 */
function travelFolders(root, path) {
	let currentNode = null;
	let currentLevel = root;

	for (const name of path) {
		if (!Array.isArray(currentLevel)) return null;

		currentNode = currentLevel.find(
			(node) => node.type === 'folder' && node.title === name
		);

		if (!currentNode) return null;

		currentLevel = currentNode.children;
	}

	return currentNode;
}
