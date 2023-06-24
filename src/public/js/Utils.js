/**
 * Clear all error messages on form
 */
function clearErrorInputs() {
  const elList = document.getElementsByClassName("has-error");

  for (const el of elList) el.textContent = "";
}
/**
 * Add error messages next to input elements in form
 * @param {HTMLFormElement} form
 * @param {Object} obj Object containing input name values as key and error messages as values
 */
function notifyInputs(form, obj) {
  for (const [key, val] of Object.entries(obj)) {
    if (key === "message") {
      addToNextEl(form.btn, val, false);
      continue;
    }
    addToNextEl(form[key], val, false);
  }
}
/**
 * Add a text to next Element with classname
 * @param {HTMLElement} el
 * @param {String} message text content
 * @param {Boolean} isSuccess add css class 'has-success' or 'has-error'
 */
function addToNextEl(el, message, isSuccess = true) {
  if (message === "") {
    emptyNextEl(el);
    return;
  }

  const nextEl = el.closest(".control").nextElementSibling;
  nextEl.textContent = message;

  nextEl.classList.remove(isSuccess ? "has-error" : "has-success");
  nextEl.classList.add(isSuccess ? "has-success" : "has-error");
}

/**
 * Add a text to next Element with classname
 * @param {HTMLElement} el
 * @param {String} classname css classname to remove from element
 */
function emptyNextEl(el) {
  const nextEl = el.parentNode.nextElementSibling;
  nextEl.textContent = "";
  nextEl.classList.remove("has-error");
  nextEl.classList.remove("has-success");
}

/**
 * A random number between 0 and 1 casted to an hexadecimal string and the
 * decimal part returned
 * @return {String} returns a random string upto 14 characters length
 */
function randomString() {
  return Math.random().toString(16).substring(2);
}

export {
  clearErrorInputs,
  notifyInputs,
  addToNextEl,
  emptyNextEl,
  randomString,
};
