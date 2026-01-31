import { createViewBinding } from '../../../@libraries/view_binding/index.mjs'

const { viewBinding: homeViewBinding } = createViewBinding({
	messageBox: '.message',
	hiddenDataContainer: '.hidden-data-container',
	gridContainer: '.grid-container',
	paginationBody: '.pagination-body',
})

export { homeViewBinding }
