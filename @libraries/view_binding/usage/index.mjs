import createViewBinding from '../index.mjs';

const appViewBinding = createViewBinding({
	title: '#title as h1',
	inputField: '#inputField as input',
	submitButton: '#submitButton as button',
	items: '.items li as li[]',
	appContainer: '#app as div',
});

const appViews = appViewBinding.bind();
// Không truyền tham số vào bind thì mặc định lấy document.querySelector(...)
// Nếu truyền vào HTMLElement thì lấy element.querySelector(...) (dùng khi làm việc với nhiều item có cấu trúc giống nhau)

// Sử dụng các phần tử đã bind
if (appViews.title) appViews.title.textContent = 'Binding successful';

let count = 0;

appViews.submitButton?.addEventListener('click', () => {
	const newItem = document.createElement('li');
	newItem.textContent = appViews.inputField?.value || `New item ${++count}`;
	appViews.appContainer?.querySelector('.items')?.appendChild(newItem);

	appViews.rebind();

	console.log(
		'Current list of items:',
		appViews.items.map((el) => el.textContent)
	);
});
