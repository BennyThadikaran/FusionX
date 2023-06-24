import { addToNextEl, notifyInputs, clearErrorInputs } from "./Utils.js";
import ajax from "./ajax/src/ajax.js";
import validate from "./validate.js/src/validate.js";
import cache from "./cache.js/src/cache.js";
import node from "./node.js/src/node.js";

const store = cache();

const options = {
  name: { noRepetition: true, matchName: true, min: 2, max: 30 },
};

/**
 * Create user with assigned role
 * @param {HTMLFormElement} el
 */
async function createUser(el) {
  el.btn.disabled = true;
  clearErrorInputs();
  const fd = new FormData(el);

  const fname = fd.get("fname");
  const lname = fd.get("lname");
  const email = fd.get("email");
  const role = fd.get("role");

  const validation = [
    validate.string(fname, { name: "First Name", ...options.name }, "fname"),
    validate.string(lname, { name: "Last Name", ...options.name }, "lname"),
    validate.email(email),
  ];

  if (validation.indexOf(false) > -1) {
    notifyInputs(el, validate.log);
    el.btn.disabled = false;
    validate.clear();
    return;
  }

  if (role === "none") {
    addToNextEl(el.role, "Select a user role", false);
    el.btn.disabled = false;
    return;
  }

  const [code, msg] = await ajax.post("/profile/admin/user", fd, {
    "x-csrf-token": el.csrf.value,
  });

  el.btn.disabled = false;
  if (code !== 200) return addToNextEl(el.btn, "There was an error", false);

  if (msg.status === "success") {
    store.clear();
    return addToNextEl(el.btn, msg.data);
  }

  if (msg.data instanceof Object) {
    notifyInputs(el, msg.data);
    return;
  }
  addToNextEl(el.btn, msg.data, false);
}

/**
 * @param {HTMLFormElement} el
 */
async function createBlogPost(el) {
  clearErrorInputs();
  el.btn.disabled = true;
  const fd = new FormData(el);
  const newTags = fd.get("newTags");
  const tags = fd.getAll("tags");
  const img = fd.get("img");
  const imgAlt = fd.get("imgAlt");

  const validation = [
    validate.string(
      fd.get("title"),
      { name: "Title", min: 10, max: 200 },
      "title"
    ),
    validate.string(
      fd.get("description"),
      { name: "Description", min: 10, max: 1000 },
      "description"
    ),
    validate.string(img, { name: "Image" }, "img"),
    validate.string(imgAlt, { name: "Alt text", min: 5, max: 60 }, "imgAlt"),
  ];

  if (validation.indexOf(false) > -1) {
    notifyInputs(el, validate.log);
    el.btn.disabled = false;
    validate.clear();
    return;
  }

  if (!newTags && !tags.length) {
    addToNextEl(
      el.newTags,
      "Select tags from options provided or add new tags",
      false
    );
    el.btn.disabled = false;
    return;
  }

  for (const tag of newTags.split(",")) {
    if (tag === "") continue;
    let str = tag.trim();
    str = `${str.charAt(0).toUpperCase()}${str.substring(1).toLowerCase()}`;
    fd.append("tags", str);
  }

  fd.delete("newTags");

  if (fd.getAll("tags").length > 4) {
    addToNextEl(el.newTags, "Only a max of 4 tags allowed", false);
    el.btn.disabled = false;
    return;
  }

  const file = fd.get("fileUpload");
  const { name, size, type } = file;
  const fileEl = document.getElementById("file-select");

  if (type !== "text/html") {
    fileEl.classList.add("has-error");
    fileEl.textContent = "Expected file of type text/html";
    el.btn.disabled = false;
    return;
  }

  if (size > 400000) {
    fileEl.classList.add("has-error");
    fileEl.textContent = "File size cannot exceed 400kb";
    el.btn.disabled = false;
    return;
  }

  // clean html file of any unsafe elements
  const clean = DOMPurify.sanitize(await file.text(), {
    USE_PROFILES: { html: true },
  });

  // convert clean html string to Blob and further to a File Object
  const cleanHTMLFile = new File([new Blob([clean])], name, {
    type: "text/html",
  });

  fd.set("body", cleanHTMLFile);
  fd.delete("fileUpload");

  // set csrf value
  fd.set("csrf", el.csrf.value);

  const url = "/profile/admin/blog-post";

  const [code, msg] = await ajax.uploadFile(url, "POST", fd, {
    "x-csrf-token": el.csrf.value,
  });

  el.btn.disabled = false;

  if (code !== 200) return addToNextEl(el.btn, "There was an error", false);

  if (msg.status === "success") {
    store.clear();
    return addToNextEl(el.btn, msg.data);
  }

  if (msg.data instanceof Object) {
    notifyInputs(el, msg.data);
    return;
  }
  addToNextEl(el.btn, msg.data, false);
}

/**
 * @param {Event} e
 */
function submitHandler(e) {
  const el = e.target;
  e.preventDefault();

  const routes = {
    createUser,
    createBlogPost,
  };

  if (el.name in routes) routes[el.name](el);
}

window.addEventListener("DOMContentLoaded", async function () {
  document.addEventListener("submit", submitHandler);

  const form = document.forms.createBlogPost;
  if (
    form &&
    form.fileUpload.parentNode.lastElementChild.className !== "file-name" &&
    form.fileUpload.value
  ) {
    const el = node.create(
      "span",
      { class: "file-name" },
      form.fileUpload.value.split(/[\\\/]/).pop()
    );
    form.fileUpload.parentNode.appendChild(el);
  }
});
