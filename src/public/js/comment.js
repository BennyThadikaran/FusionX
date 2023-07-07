import { commentListLimit } from "./variables.js";
import { addToNextEl } from "./Utils.js";
import validate from "./validate.js/src/validate.js";
import ajax from "./ajax/src/ajax.js";
import node from "./node.js/src/node.js";
import cache from "./cache.js/src/cache.js";

const store = cache();
const cacheExpiry = 30 * 60; // 30 minutes

const comment = (function () {
  "use strict";

  /**
   * Adds the comment and commentId to comment form textarea
   * Only users own comments can be edited
   * @param {HTMLElement} el
   */
  function edit(el) {
    const form = document.forms.comment;
    reset(form._reset);

    form.scrollIntoView();
    let p = el.parentNode;

    // Loop up till we find <article id=''>
    while (p.tagName !== "ARTICLE") p = p.parentNode;
    const commentWrapper = document.getElementById(p.id);

    const textarea = form.commentText;

    // add the comment text to textarea
    textarea.value =
      commentWrapper.getElementsByClassName("subtitle")[0].textContent;

    // Add the commentId as data-edit
    textarea.dataset.edit = p.id;
  }

  /**
   * Prepares the comment form to reply to comment
   * @param {HTMLElement} el
   */
  function reply(el) {
    reset(document.forms.comment._reset);
    let p = el.parentNode;

    // Loop up till we find <article id='<commentId'>
    while (p.tagName !== "ARTICLE") p = p.parentNode;
    const commentWrapper = document.getElementById(p.id);

    const form = document.forms.comment;
    form.scrollIntoView(true);

    // get the name of user we're replying to
    const name = commentWrapper.getElementsByClassName("title")[0].textContent;

    form.commentText.dataset.reply_id = p.id;
    form.commentText.dataset.reply_name = name;

    // the field class groups the submit and reset buttons
    const field = form.btn.parentNode.parentNode;

    if (field.lastChild.tagName === "SPAN") {
      field.lastChild.textContent = `Replying to ${name}`;
      return;
    }

    const tag = node.create(
      "span",
      { class: "tag is-medium" },
      `Replying to ${name}`
    );

    field.insertAdjacentElement("beforeend", tag);
  }

  /**
   * Resets comment form and removes data-edit and data-reply attributes
   * @param {HTMLElement} el reset button element
   */
  function reset(el) {
    const lastFieldElement = el.parentNode.parentNode.lastChild;

    if (lastFieldElement.tagName === "SPAN") lastFieldElement.remove();
    el.form.commentText.removeAttribute("data-edit");
    el.form.commentText.removeAttribute("data-reply_id");
    el.form.commentText.removeAttribute("data-reply_name");
    el.form.reset();
  }

  /**
   * Generate HTML for avatar on user comment
   * @param {String} name
   * @return {Promise.<HTMLElement>}
   */
  function getAvatar(name) {
    const fig = node.create("figure", { class: "media-left avatar" });

    // John Doe -> JD
    const initial = name.charAt() + name.charAt(name.indexOf(" ") + 1);

    fig.appendChild(node.create("p", null, initial));
    return fig;
  }

  /**
   * Generates comment form
   * @param {String} csrf string to be inserted in hidden input
   * @param {String} name full name of logged user
   * @param {Boolean} isLogged is the user logged?
   */
  function generateForm(csrf, name, isLogged) {
    const wrapper = document.getElementById("comment-form");

    if (!isLogged) {
      const a = node.create(
        "a",
        {
          class: "button is-info centered-block",
          href: "/profile/login",
        },
        "Login To Comment"
      );

      wrapper.appendChild(a);
      return;
    }

    const frag = document.createDocumentFragment();

    // figure
    const fig = getAvatar(name);

    // media-content
    const content = node.create("div", { class: "media-content" });
    const form = node.create("form", { name: "comment" });

    const field = node.create("div", { class: "field is-grouped" });
    const field1 = node.create("div", { class: "field" });

    const control = node.create("div", { class: "control" });
    const control1 = control.cloneNode();
    const control2 = control.cloneNode();

    const textareaField = node.create("textarea", {
      class: "textarea",
      placeholder: "Add a comment...",
      name: "commentText",
    });

    const help = node.create("div", { class: "help is-size-6" });

    control2.appendChild(textareaField);
    node.append([control2, help], field1);

    const csrfInput = node.create("input", {
      type: "hidden",
      name: "csrf",
      value: csrf,
    });

    const submit = node.create(
      "button",
      {
        class: "button is-info",
        name: "btn",
        type: "submit",
        formnovalidate: true,
      },
      "Submit"
    );

    const reset = node.create(
      "button",
      {
        class: "button is-info",
        name: "_reset",
        type: "reset",
        "data-name": "reset",
      },
      "Reset"
    );

    control.appendChild(submit);
    control1.appendChild(reset);
    node.append([control, control1], field);
    node.append([csrfInput, field1, field], form);
    content.appendChild(form);
    node.append([fig, content], frag);
    wrapper.appendChild(frag);
  }

  /**
   * Generate html for individual comment
   * @param {Object} msg comment object
   * @param {Boolean} isLogged is the user logged?
   * @return {HTMLElement}
   */
  function generateComment(msg, isLogged) {
    const wrapper = node.create("article", { class: "media", id: msg._id });
    const dt = new Date(msg.dt);

    // figure
    const fig = getAvatar(msg.name);

    // media-content
    const mediaContent = node.create("div", { class: "media-content" });

    // content
    const content = node.create("div", { class: "content" });

    // meta info
    const title = node.create("span", { class: "title is-4" }, msg.name);
    const subtitle = node.create(
      "p",
      { class: "subtitle is-6" },
      msg.commentText
    );

    const meta = node.create("p");

    meta.appendChild(title);

    if (msg.replied) {
      const reply = node.create("small", null, " replied to ");

      reply.appendChild(
        node.create("a", { href: `#${msg.replied.id}` }, msg.replied.name)
      );

      meta.appendChild(reply);
    }

    const small = node.create("small", null, " on ");

    small.appendChild(
      node.create("time", { datetime: dt.toISOString() }, dt.toUTCString())
    );

    meta.appendChild(small);
    node.append([meta, subtitle], content);
    mediaContent.appendChild(content);

    // navigation
    if (isLogged) {
      const nav = node.create("nav", { class: "level is-mobile" });
      const navDiv = node.create("div", { class: "level-left" });

      if (msg.editable) {
        navDiv.appendChild(
          node.create("a", { class: "level-item", "data-name": "edit" }, "Edit")
        );
      } else {
        navDiv.appendChild(
          node.create(
            "a",
            { class: "level-item", "data-name": "reply" },
            "Reply"
          )
        );
      }

      nav.appendChild(navDiv);
      mediaContent.appendChild(nav);
    }

    node.append([fig, mediaContent], wrapper);
    return wrapper;
  }

  /**
   * Generates the list of comments
   * @param {Array.<Object>} comments array of comment objects
   * @param {String} userId id of logged user
   * @param {Boolean} isLogged is the user logged?
   * @return {DocumentFragment}
   */
  function generateCommentList(comments, userId, isLogged) {
    const frag = document.createDocumentFragment();

    for (const msg of comments) {
      if (userId === msg.userId) msg.editable = true;

      frag.appendChild(generateComment(msg, isLogged));
    }
    return frag;
  }

  /**
   * Fetch comments from the server
   * @param {String} [commentId = null] used to paginate more comments
   */
  async function get(commentId = null) {
    const formWrapper = document.getElementById("comment-form");
    const commentWrapper = document.getElementById("comment");
    let url = `/blog/comments/${formWrapper.dataset.id}`;

    if (commentId) url += `?id=${commentId}`;

    let data = store.oGet(url);

    if (!data) {
      const [code, msg] = await ajax.get(url);

      if (code !== 200 || msg.status === "error") {
        const el = document.getElementById("comment-form");
        el.className = "is-size-4 has-text-centered";
        el.textContent = "Error Loading Comments";
        return;
      }

      data = msg.data;
      store.oSet(url, data, cacheExpiry);
    }

    const { csrf, name, logged, id, comments, count } = data;

    // not a paginated request
    if (!commentId) {
      generateForm(csrf, name, logged);

      // add comment count to blog post page
      if (count) {
        const tag = document.getElementById("tag_comment");

        const span = node.create("span", { class: "tag is-medium" });
        const a = node.create(
          "a",
          { href: "#comment-form" },
          `${count} Comments`
        );

        span.appendChild(a);
        tag.appendChild(span);
      }

      // if no comments
      if (!comments.length) {
        const p = node.create(
          "p",
          { class: "m-3 has-text-weight-bold has-text-centered" },
          "Be the first to comment."
        );

        commentWrapper.appendChild(p);
        return;
      }

      // load more button
      const divBtn = node.create("div", { class: "has-text-centered mt-6" });

      const btn = node.create(
        "button",
        {
          class: "button is-info is-medium",
          id: "loadBtn",
          "data-id": comments.at(-1)._id,
          "data-name": "commentLoadMore",
        },
        "Load More"
      );

      if (comments.length < commentListLimit) btn.disabled = true;

      divBtn.appendChild(btn);
      commentWrapper.parentNode.appendChild(divBtn);
    }

    const frag = generateCommentList(comments, id, logged);
    commentWrapper.appendChild(frag);

    if (commentId) {
      const loadBtn = document.getElementById("loadBtn");

      if (comments.length < commentListLimit) {
        loadBtn.disabled = true;
      } else {
        loadBtn.dataset.id = comments.at(-1)._id;
      }
    }
  }

  /**
   * Apply css animation to highlight the comment
   * @param {HTMLElement} el element to highlight
   */
  function highlight(el) {
    el.scrollIntoView(true);
    el.classList.add("alertPulse");
    el.addEventListener("animationend", () =>
      el.classList.remove("alertPulse")
    );
  }

  /**
   * Process Comment form
   * @param {HTMLFormElement} form
   */
  async function process(form) {
    form.btn.disabled = true;
    const commentForm = document.getElementById("comment-form");
    const wrapper = document.getElementById("comment");
    const blogId = commentForm.dataset.id;
    const commentText = form.commentText.value.trim();
    const editCommentId = form.commentText.dataset.edit;
    const replyCommentId = form.commentText.dataset.reply_id;
    const replyCommentName = form.commentText.dataset.reply_name;
    const commentWrapper = document.getElementById(editCommentId);
    const bodyEl = commentWrapper
      ? commentWrapper.getElementsByClassName("subtitle")[0]
      : null;

    let code;
    let msg;

    if (editCommentId) {
      if (bodyEl.textContent === commentText) {
        highlight(commentWrapper);
        form.btn.disabled = false;
        return;
      }
    }

    const isValid = validate.string(
      commentText,
      { name: "Comment", max: 200 },
      "commentText"
    );

    if (!isValid || !blogId) {
      form.btn.disabled = false;
      addToNextEl(form.commentText, validate.log["commentText"], false);
      validate.clear();
      return;
    }

    const fd = new FormData(form);

    if (replyCommentId) {
      fd.append("replyId", replyCommentId);
      fd.append("replyName", replyCommentName);
    }

    if (editCommentId) {
      fd.append("postId", blogId);

      [code, msg] = await ajax.put(`/blog/comments/${editCommentId}`, fd, {
        "x-csrf-token": form.csrf.value,
      });
    } else {
      [code, msg] = await ajax.post(`/blog/comments/${blogId}`, fd, {
        "x-csrf-token": form.csrf.value,
      });
    }

    form.btn.disabled = false;

    if (code === 200 && msg.status === "success") {
      store.clear();
      // removes the p tag with 'Be the first to comment.'
      if (wrapper.lastChild.tagName === "P") wrapper.lastChild.remove();
      reset(form._reset);

      if (editCommentId) {
        bodyEl.textContent = msg.data.commentText;
        highlight(commentWrapper);
        return;
      }

      const commentHTML = generateComment(
        {
          _id: msg.data._id,
          name: msg.data.name,
          commentText: msg.data.commentText,
          replied: msg.data.replied,
          dt: new Date().toJSON(),
          editable: true,
        },
        true
      );

      wrapper.insertAdjacentElement("afterbegin", commentHTML);
      const newComment = document.getElementById(msg.data._id);
      highlight(newComment);
      return;
    }

    if (code >= 400) {
      return addToNextEl(form.commentText, unknownError, false);
    }

    return addToNextEl(form.commentText, msg.data, false);
  }

  return Object.freeze({
    edit: edit,
    reply: reply,
    reset: reset,
    process: process,
    get: get,
  });
})();

export default comment;
