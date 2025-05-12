import decoratorManager from '../../@libraries/decorators/index.mjs';
import { SearchSuggestion } from '../app.models.mjs';
import * as utils from '../app.utils.mjs';
import CategoryStorage from './storages/CategoryStorage.mjs';
import PrefixStorage from './storages/PrefixStorage.mjs';
import TrackStorage from './storages/TrackStorage.mjs';

class Database {
	/**
	 * @param {string} resourcePath
	 */
	constructor(resourcePath = '/@resources/databases/s1/') {
		resourcePath = resourcePath.endsWith('/')
			? resourcePath
			: resourcePath + '/';

		this.CVs = new CategoryStorage('cv', resourcePath);
		this.tags = new CategoryStorage('tag', resourcePath);
		this.series = new CategoryStorage('series', resourcePath);

		this.prefixies = new PrefixStorage(resourcePath);
		this.tracks = new TrackStorage(resourcePath);
	}

	/**
	 * @param {string} keyword
	 * @param {number[]} IDs
	 */
	async searchTracks(keyword, IDs = []) {
		if (!IDs.length) IDs = await this.tracks.getIDs();
		const lowerCaseKeyword = keyword.toString().toLowerCase();
		const keyResults = new Set();

		// Track kết quả tạm với vị trí index ban đầu
		const trackPromises = IDs.map((id, index) =>
			this.tracks.get(id).then((track) => ({ id, track, index }))
		);

		const results = await Promise.all(trackPromises);

		// Tiến hành lọc kết quả:
		for (const { id, track, index } of results) {
			if (!track) continue;

			let {
				info: { RJcode, eName, jName },
				category: { cvIDs, tagIDs, seriesIDs },
			} = track;

			// Chuẩn hóa dữ liệu
			[RJcode, eName, jName] = [RJcode, eName, jName].map((str) =>
				str.toLowerCase()
			);

			// Nếu tìm thấy trong thông tin chính
			if (
				[id.toString(), RJcode, eName, jName].some((prop) =>
					prop.includes(lowerCaseKeyword)
				)
			) {
				keyResults.add({ id, index });
				continue;
			}

			// Nếu tìm thấy trong category
			await Promise.all([
				checkCategory(cvIDs, id, index, this.CVs),
				checkCategory(tagIDs, id, index, this.tags),
				checkCategory(seriesIDs, id, index, this.series),
			]);
		}

		/**
		 * @template {'cv' | 'tag' | 'series'} CategoryType
		 * @param {number[]} IDs
		 * @param {number} id
		 * @param {number} index
		 * @param {CategoryStorage<CategoryType>} categoryMap
		 */
		async function checkCategory(IDs, id, index, categoryMap) {
			const categoryPromises = IDs.map((id) =>
				categoryMap.get(id).then((category) => ({
					category,
					id,
				}))
			);

			const categories = await Promise.all(categoryPromises);
			for (const { category } of categories) {
				if (
					category &&
					category.name.toLowerCase().includes(lowerCaseKeyword)
				) {
					keyResults.add({ id, index });
					break; // Chỉ cần tìm thấy 1 lần là đủ
				}
			}
		}

		// Sắp xếp theo index gốc
		return [...keyResults]
			.sort((a, b) => a.index - b.index)
			.map((item) => item.id);
	}

	/**
	 * @param {string} keyword
	 * @returns {Promise<SearchSuggestion<'code' | 'RJcode' | 'cv' | 'tag' | 'series' | 'eName' | 'jName'>[]>}
	 */
	async getSearchSuggestions(keyword) {
		const IDs = await this.tracks.getIDs();
		const lowerCaseKeyword = keyword.toLowerCase();
		const suggestions = [];
		const seen = new Set();

		// Duyệt tất cả IDs và tạo các Promise song song
		const trackPromises = IDs.map(async (id, index) => {
			const track = await this.tracks.get(id);
			if (!track) return null;

			const { RJcode, jName, eName } = track.info;
			const { cvIDs, tagIDs, seriesIDs } = track.category;

			// Check thông tin chính
			await checkInfor('code', id.toString(), index, id);
			await checkInfor('RJcode', RJcode, index, id);
			await checkInfor('eName', eName, index, id);
			await checkInfor('jName', jName, index, id);

			// Check thông tin category
			await checkCategory('cv', cvIDs, this.CVs, index);
			await checkCategory('tag', tagIDs, this.tags, index);
			await checkCategory('series', seriesIDs, this.series, index);
		});

		// Chờ tất cả các Promise hoàn tất
		await Promise.all(trackPromises);

		// Sắp xếp lại theo index gốc trước khi sort theo relevance
		suggestions.sort((a, b) => a.index - b.index);
		suggestions.sort(utils.sort.bySuggestionRelevance);

		return suggestions;

		/**
		 * @param {keyof typeof track.info} type
		 * @param {string} standardizedProp
		 * @param {number} index
		 * @param {number} id
		 */
		async function checkInfor(type, standardizedProp, index, id) {
			const setKey = `${type}::${standardizedProp}`;
			if (
				!seen.has(setKey) &&
				standardizedProp.toLowerCase().includes(lowerCaseKeyword)
			) {
				suggestions.push({
					...new SearchSuggestion(type, standardizedProp, keyword, id),
					index,
				});
				seen.add(setKey);
			}
		}

		/**
		 * @template {'cv' | 'tag' | 'series'} CategoryType
		 * @param {CategoryType} type
		 * @param {number[]} IDs
		 * @param {CategoryStorage<CategoryType>} categoryMap
		 * @param {number} index
		 */
		async function checkCategory(type, IDs, categoryMap, index) {
			const categoryPromises = IDs.map(async (id) => {
				const category = await categoryMap.get(id);
				if (!category) return;

				const setKey = `${category.type}::${id}`;
				if (
					!seen.has(setKey) &&
					category.name.toLowerCase().includes(lowerCaseKeyword)
				) {
					suggestions.push({
						...new SearchSuggestion(type, category.name, keyword, undefined),
						index,
					});
					seen.add(setKey);
				}
			});
			await Promise.all(categoryPromises);
		}
	}

	export() {
		window.database = this;
	}
}

decoratorManager
	.applyFor(TrackStorage, ['get'], ['memoize'])
	.applyFor(Database, ['searchTracks', 'getSearchSuggestions'], ['memoize']);

export const database = new Database();
