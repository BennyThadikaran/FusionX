'use strict';

/**
 * Validate module
 * A utility for validating user input
 * @namespace validate
 */
const validate = (function () {
  const log = {};
  // https://www.emailregex.com/
  const local = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))/;
  const ip = /(\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])/;
  const domain = /(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,})$/;

  const nameRe = new RegExp(/[a-zA-Z'-]+/);
  const fullnameRe = new RegExp(/[a-zA-Z'-\s]+/);
  const postalCodeRe = new RegExp(/[1-9][0-9]{5}/);
  const emailRe = new RegExp(`${local.source}@(${ip.source}|${domain.source})`);

  // https://www.rfc-editor.org/errata_search.php?rfc=3696&eid=1690
  const mobRe = new RegExp(/\d{10}/);

  /**
   * @param {String} str email to validate
   * @param {String|null} [name=null] field name to log
   * @return {Boolean} true if no error
   */
  function email(str, name = null) {
    if (!name) name = "email";

    if (!str || typeof str !== "string") {
      log[name] = "Email is required.";
      return false;
    }

    if (str.length < 6 || str.length > 254 || !emailRe.test(str)) {
      log[name] = "Please enter a valid email.";
      // https://www.rfc-editor.org/errata_search.php?rfc=3696&eid=1690
      return false;
    }
    return true;
  }

  /**
   * @param {String} str email to validate
   * @param {String|null} [name=null] field name to log
   * @return {Boolean} true if no error
   */
  function mobile(str, name = null) {
    if (!name) name = "mobile";
    if (!str || typeof str !== "string") {
      log[name] = "Mobile no is required.";
      return false;
    }

    if (str.length !== 10 || !mobRe.test(str)) {
      log[name] = "Please enter a valid mobile no.";
      return false;
    }

    return true;
  }

  /**
   * @param {String} str password to validate
   * @param {String|Number} passwordStrength derived from zxcvbn
   * @param {String|null} [name=null] field name to log
   * @return {Boolean} true if no error
   */
  function password(str, passwordStrength, name = null) {
    if (!name) name = "pwd";

    if (!str || typeof str !== "string") {
      log[name] = "Password is required.";
      return false;
    }

    if (str.length < 10) {
      log[name] = "Password must be atleast 10 characters.";
      return false;
    }

    if (!passwordStrength) return true;

    if (Number.parseInt(passwordStrength, 10) < 3) {
      log[name] = "Please provide a stronger password.";
      return false;
    }

    return true;
  }

  /**
   * Checks for repeated character sequences
   * https://quickref.me/check-if-a-string-consists-of-a-repeated-character-sequence
   * @param {String} str
   * @return {Boolean}
   */
  function isRepeated(str) {
    return `${str}${str}`.indexOf(str, 1) !== str.length;
  }

  /**
   * Generic validation for strings
   * Allowed options
   * name: (String) form field name
   * noRepetition: (Boolean) no repeating sequence of characters
   * matchName: (Boolean) Match name with a - z, ' and -
   * matchFullname: (Boolean) Match name with a - z, ', - and space chars
   * min: (Integer) minimum characters allowed
   * max: (Integer) maximum characters allowed
   * @param {String} str string to validate
   * @param {Object} opts
   * @param {String|null} [name=null] field name to log
   * @return {Boolean} true if no error
   */
  function string(str, opts, name = null) {
    if (!name) name = "Input";
    if (!opts.name) opts.name = "Input";

    if (!str || typeof str !== "string") {
      log[name] = `${opts.name} is required`;
      return false;
    }

    if (opts.fixedLength && str.length !== opts.fixedLength) {
      log[name] = `${opts.name} must be ${opts.fixedLength} characters`;
      return false;
    }

    if (opts.min && str.length < opts.min) {
      log[name] = `${opts.name} cannot be less than ${opts.min} characters`;
      return false;
    }

    if (opts.max && str.length > opts.max) {
      log[name] = `${opts.name} cannot be longer than ${opts.max} characters`;
      return false;
    }

    if (opts.noRepetition && isRepeated(str)) {
      log[name] = `Please provide a valid ${opts.name}`;
      return false;
    }

    if (opts.matchName) {
      const match = str.match(nameRe);

      if (match === null || !match.length || match[0].length !== str.length) {
        log[name] = `Only a - z, ' and - characters are allowed.`;
        return false;
      }
    }

    if (opts.matchFullname) {
      const match = str.match(fullnameRe);

      if (match === null || !match.length || match[0].length !== str.length) {
        log[name] = `Only a - z, ', - and <space> characters are allowed.`;
        return false;
      }
    }

    if (opts.matchPostalCode) {
      const match = str.match(postalCodeRe);

      if (match === null || !match.length || match[0].length !== str.length) {
        log[name] = `Not a valid Pincode`;
        return false;
      }
    }

    return true;
  }

  /**
   * Clear the logs
   * @return {Boolean}
   */
  function clear() {
    Object.keys(log).forEach((el) => delete log[el]);
    return true;
  }

  return Object.freeze({
    log,
    clear,
    email,
    password,
    mobile,
    string,
  });
})();

module.exports = validate;
