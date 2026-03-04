// import './data/1.js';
// import './data/2.js';
// import './data/3.js';
// import './data/4.js';
// export { data } from './data/index.js';

// Update 4/3/2026
import fs from 'fs/promises'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

export let data = (await fs.readFile(path.resolve(__dirname, './data.csv'), { encoding: 'utf-8' }))
	.split('\n\n')
	.map((track) => track.split('\n').map((info, index) => (index === 0 ? parseInt(info) : info.trim())))
