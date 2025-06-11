const isMobileDevice = () =>
	/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (!isMobileDevice() && !localStorage.getItem('menu-state'))
	localStorage.setItem('menu-state', 'opened');
if (!isMobileDevice() && localStorage.getItem('menu-state') === 'opened')
	document.documentElement.classList.add('openMenu');
