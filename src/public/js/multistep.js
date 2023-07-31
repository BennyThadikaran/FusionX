const multistep = (function () {
  let currStep = 1;
  let currTab = 0;
  let tabs;
  let progress;
  let prev;
  let next;
  let steps;
  let stepLen;

  /**
   * Initialise the multistep process
   * Callback functions passed must return a boolean
   * to indicate success or failure
   * Callback signature cb(currStep: Number, tab: HTMLElement): Boolean
   * @param {Function} [cbPrev = null] callback to execute on prev button click.
   * @param {Function} [cbNext = null] callback to execute on next button click.
   */
  function init(cbPrev = null, cbNext = null) {
    tabs = document.querySelectorAll(".multistep-tab");
    progress = document.getElementById("multistep-progress");
    steps = document.querySelectorAll(".step");
    stepLen = steps.length;
    next = document.getElementById("multistep-next");
    prev = document.getElementById("multistep-prev");

    showTab(currTab);

    next.addEventListener("click", async () => {
      window.scrollTo(0, 0);

      if (
        cbNext &&
        cbNext instanceof Function &&
        !(await cbNext(currStep, tabs[currTab]))
      )
        return;

      currStep++;
      currTab++;

      showTab(currTab);

      if (currStep > stepLen) currStep = stepLen;

      updateProgress();
    });

    prev.addEventListener("click", async () => {
      if (
        cbPrev &&
        cbPrev instanceof Function &&
        !(await cbPrev(currStep, tabs[currTab]))
      ) {
        return;
      }

      currStep--;
      currTab--;

      showTab(currTab);
      if (currStep < 1) currStep = 1;

      updateProgress();
    });
  }

  /**
   * Show the tab indicated by n, hide other tabs
   * @param {Number} n
   */
  function showTab(n) {
    tabs.forEach((tab, i) => {
      tab.style.display = i === n ? "block" : "none";
    });
  }

  /**
   * - Indicate the current step in the progress line
   * - Update next and prev button states
   */
  function updateProgress() {
    steps.forEach((step, i) => {
      i < currStep
        ? step.classList.add("active")
        : step.classList.remove("active");
    });

    progress.style.width = ((currStep - 1) / (stepLen - 1)) * 100 + "%";

    if (currStep === 1) {
      prev.disabled = true;
    } else if (currStep === stepLen) {
      next.disabled = true;
    } else {
      prev.disabled = false;
      next.disabled = false;
    }
  }

  return Object.freeze({
    init,
  });
})();

export default multistep;
