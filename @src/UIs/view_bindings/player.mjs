import { createViewBinding } from '../../../@libraries/view_binding/index.mjs';

const { viewBinding: playerViewBinding } = createViewBinding({
	fullscreenBtn: '#fullscreen-btn',
	fullscreenIcon: '#fullscreen-btn i',
	contentContainer: '.content-container',
	mp3Container: '.menu-mp3',
});

export { playerViewBinding };
