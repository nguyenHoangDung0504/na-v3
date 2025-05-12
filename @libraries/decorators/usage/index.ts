import decoratorManager from '../index.mjs';

class User {
	id: number;
	name: string;

	login(loginName: string, hassedPassword: string): Promise<boolean> {
		console.log(loginName, hassedPassword);
		return new Promise((resovle) => resovle(true));
	}

	logout(): boolean {
		return true;
	}
}

decoratorManager.applyFor(User, ['login'], ['logger', 'test']);
