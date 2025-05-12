import { ListView } from "../index.mjs";

class User {
    id; name; age;
}

const ul = new ListView(User, document.body, (t, d) => {
    t.innerHTML = d.id;
});

ul.setDataCollection([new User()]);