import Errors from 'simple-error-object';

/**
 * A formatted object for testing.
 * A given rule format becomes this like the following.
 *
 * ```
 * 'required' => { name: 'required', params: null }
 * 'email' => { name: 'email', params: null }
 * 'between:1,10' => { name: 'between', params: ['1', '10'] }
 * ```
 *
 * @typedef {Object} RuleFunctionConfig
 * @property {string} name
 * @property {(string[]|null)} params
 */

/**
 * @callback RuleFunction
 * @param {*} value
 * @param {string[]|null} params
 * @returns {boolean}
 */

/**
 * @callback PrepareRuleFunction
 * @param {Object<string, *>} values
 * @param {string} key
 * @returns {RuleFunction}
 */

/**
 * @callback RuleMessageFactory
 * @param {*} value
 * @param {string[]|null} params
 * @returns {string}
 *
 * @typedef {string|RuleMessageFactory} RuleMessage
 */

/**
 * Check and Return Error Object.
 * Error Object is Using simple-error-object.
 * https://github.com/WireframesJPN/simple-error-object
 *
 * ```
 * {
 *  user_id: 'required|email', // add validator with pipe,
 *  password: [ 'required', 'not_in:test,aaaa', 'regex:^[0-9a-zA-Z]+$' ] // or array.
 * }
 * ```
 */
export default class SimpleValid {
  /**
   * class constructor
   *
   * @param {Object<string, RuleFunction|[RuleFunction, PrepareRuleFunction]>} rules
   * @param {Object<string, RuleMessage>} messages
   */
  constructor (rules, messages) {
    /**
     * @type {Object<string, RuleFunction>}
     */
    this.rules = {};
    /**
     * @type {Object<string, RuleMessage>}
     */
    this.messages = {};
    /**
     * @type {Object<string, PrepareRuleFunction>}
     */
    this.prepares = {};

    this.addRules(rules, messages);
  }

  /**
   * Add rule.
   *
   * @param {string} name
   * @param {RuleFunction|[RuleFunction, PrepareRuleFunction]} rule
   * @param {RuleMessage} message
   */
  addRule (name, rule, message) {
    if (typeof rule !== 'function' && rule.length) {
      if (typeof rule[0] === 'function') this.rules[name] = rule[0];
      if (typeof rule[1] === 'function') this.prepares[name] = rule[1];
    } else {
      if (typeof rule === 'function') this.rules[name] = rule;
    }
    if (message) {
      this.messages[name] = message;
    }
  }

  /**
   * Add Rules.
   *
   * @param {Object<string, RuleFunction|[RuleFunction, PrepareRuleFunction]>} rules
   * @param {Object<string, RuleMessage>} messages
   */
  addRules (rules, messages) {
    for (let key in rules) {
      if (messages[key] === undefined) {
        messages[key] = `${key} was undefined`;
      }
      this.addRule(key, rules[key], messages[key]);
    }
  }

  /**
   *
   * @param values
   */
  setValues (values) {
    this.values = values;
  }

  /**
   *
   * @param target
   */
  setRules (target) {
    /**
     * // Create Rules Object Like this..
     * {
     *  'email': [
     *    { name: 'required', params: null },
     *    { name: 'email', params: null },
     *  ]
     * }
     */
    let result = {};
    for (var key in target) {
      var rules = target[key];
      var ruleStrings;
      /**
       *
       */
      if (typeof rules != 'string' && rules.length !== undefined) {
        ruleStrings = rules;
      } else {
        ruleStrings = rules.split('|');
      }
      result[key] = [];
      for (var i = 0; i < ruleStrings.length; i++) {
        result[key].push(this.createRuleObject(ruleStrings[i], key));
      }
    }

    this.check_rules = result;
  }

  /**
   * Execute validation.
   *
   * @param {Object<string, *>} values
   * @param {Object} rules
   * @param {Object} messages
   * @returns {Errors}
   */
  execute (values, rules, messages={}) {
    this.setValues(values);
    this.setRules(rules);

    const errors = new Errors();

    try {
      for (let target in this.check_rules) {
        let target_val = this.values[target] === undefined ? false : this.values[target];
        if (target_val === false) throw 'Missing Validation Target.';
        let error = this.check(this.check_rules[target], target_val);
        if (error) {
          let message = this.getMessage(error.name, target, messages);
          errors.add(target, (typeof message === 'function' ? message(error.value, error.rule.params) : message))
        }
      }
      return errors;
    } catch (e) {
      console.error(e);
    }
  }

  /**
   *
   * @param ruleString
   * @param key
   * @returns {{name: string, params: (*|null)}}
   */
  createRuleObject (ruleString, key) {
    /**
     * // Create Validation Rule Object Like this..
     * {
     *  name: '',
     *  params: []
     * }
     */
    let rule = ruleString.split(':');
    let name = rule[0];

    // Preparing Rule Object.
    /**
     * you can modify rule object if you set up the preparing object.
     */
    if (this.prepares[name] !== undefined) {
      rule = this.prepares[name](this.values, key, rule)
    }

    let params;
    if (rule[1] !== undefined) {
      params = rule[1].split(',');
    }

    return {
      name,
      params: params ? params : null
    }
  }

  /**
   *
   * @param rules
   * @param value
   * @returns {boolean|string}
   */
  check (rules, value) {
    for (let i = 0; i < rules.length; i++) {
      const result = this.checkRule(value, rules[i]);

      if (result) {
        return result;
      }
    }

    return false;
  }

  /**
   * Check validation rules and add error if exist.
   *
   * @param {*} value
   * @param {RuleFunction} rule
   * @returns {string|{name: string, value: *, rule: RuleFunction}|boolean}
   */
  checkRule (value, rule) {
    const { name, params } = rule;

    if (this.rules[name] === undefined) return 'norule';

    return this.rules[name](value, params) ? { name, value, rule } : false;
  }

  /**
   * get error message for the property.
   * If no message is given, the default message will return.
   *
   * @param {string} name
   * @param {string} target
   * @param {Object} [message]
   * @returns {RuleMessage}
   */
  getMessage (name, target, message) {
    let _message;
    if (message && message[target] !== undefined && message[target][name] !== undefined) {
      _message = message[target][name];
    } else {
      _message = this.messages[name]
    }
    return _message;
  }
}

