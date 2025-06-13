import { createViewBinding } from '../../../@libraries/view_binding/index.mjs';

const { viewBinding: watchViewBinding } = createViewBinding({
	vidFrame: '#vid_frame',
	pRJcode: '[p-rjcode]',
	pEngname: '[p-engname]',
	otherLinkCtn: '#other_links',
	seriesCtn: '#track_series',
	pCVlabel: '[p-cv-label]',
	cvCtn: '#track_list_cv',
	pTagLabel: '[p-tag-label]',
	tagCtn: '#track_list_tag',
	downloadLink: '#download-box > a = a',
	descriptionCtn: '#track-description',
	randomPostCtn: '#random-post',
	closeMenuLayer: '.close-menu',
});

const { viewBinding: randomPostViewBinding } = createViewBinding({
	img: 'img',
	pRJcode: '[p-rjcode]',
	pEngname: '[p-engname]',
});

export { watchViewBinding, randomPostViewBinding };
