/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMSelect
 */

'use strict';

var LinkedValueUtils = require('LinkedValueUtils');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var ReactUpdates = require('ReactUpdates');

var assign = require('Object.assign');
var warning = require('warning');

var didWarnValueLink = false;
var didWarnValueNull = false;

function updateOptionsIfPendingUpdateAndMounted() {
  if (this._rootNodeID && this._wrapperState.pendingUpdate) {
    this._wrapperState.pendingUpdate = false;

    var props = this._currentElement.props;
    var value = LinkedValueUtils.getValue(props);

    if (value != null) {
      updateOptions(this, props, value);
    }
  }
}

function getDeclarationErrorAddendum(owner) {
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

function warnIfValueIsNull(props) {
  if (props != null && props.value === null && !didWarnValueNull) {
    warning(
      false,
      '`value` prop on `select` should not be null. ' +
      'Consider using the empty string to clear the component or `undefined` ' +
      'for uncontrolled components.'
    );

    didWarnValueNull = true;
  }
}

var valuePropNames = ['value', 'defaultValue'];

/**
 * Validation function for `value` and `defaultValue`.
 * @private
 */
function checkSelectPropTypes(inst, props) {
  var owner = inst._currentElement._owner;
  LinkedValueUtils.checkPropTypes(
    'select',
    props,
    owner
  );

  if (props.valueLink !== undefined && !didWarnValueLink) {
    warning(
      false,
      '`valueLink` prop on `select` is deprecated; set `value` and `onChange` instead.'
    );
    didWarnValueLink = true;
  }

  for (var i = 0; i < valuePropNames.length; i++) {
    var propName = valuePropNames[i];
    if (props[propName] == null) {
      continue;
    }
    if (props.multiple) {
      warning(
        Array.isArray(props[propName]),
        'The `%s` prop supplied to <select> must be an array if ' +
        '`multiple` is true.%s',
        propName,
        getDeclarationErrorAddendum(owner)
      );
    } else {
      warning(
        !Array.isArray(props[propName]),
        'The `%s` prop supplied to <select> must be a scalar ' +
        'value if `multiple` is false.%s',
        propName,
        getDeclarationErrorAddendum(owner)
      );
    }
  }
}

/**
 * @param {ReactDOMComponent} inst
 * @param {boolean} multiple
 * @param {*} propValue A stringable (with `multiple`, a list of stringables).
 * @private
 */
function updateOptions(inst, multiple, propValue) {
  var selectedValue, i;
  var options = ReactDOMComponentTree.getNodeFromInstance(inst).options;

  if (multiple) {
    selectedValue = {};
    for (i = 0; i < propValue.length; i++) {
      selectedValue['' + propValue[i]] = true;
    }
    for (i = 0; i < options.length; i++) {
      var selected = selectedValue.hasOwnProperty(options[i].value);
      if (options[i].selected !== selected) {
        options[i].selected = selected;
      }
    }
  } else {
    // Do not set `select.value` as exact behavior isn't consistent across all
    // browsers for all cases.
    selectedValue = '' + propValue;
    for (i = 0; i < options.length; i++) {
      if (options[i].value === selectedValue) {
        options[i].selected = true;
        return;
      }
    }
    if (options.length) {
      options[0].selected = true;
    }
  }
}

/**
 * Implements a <select> native component that allows optionally setting the
 * props `value` and `defaultValue`. If `multiple` is false, the prop must be a
 * stringable. If `multiple` is true, the prop must be an array of stringables.
 *
 * If `value` is not supplied (or null/undefined), user actions that change the
 * selected option will trigger updates to the rendered options.
 *
 * If it is supplied (and not null/undefined), the rendered options will not
 * update in response to user actions. Instead, the `value` prop must change in
 * order for the rendered options to update.
 *
 * If `defaultValue` is provided, any options with the supplied values will be
 * selected.
 */
var ReactDOMSelect = {
  getNativeProps: function(inst, props) {
    return assign({}, props, {
      onChange: inst._wrapperState.onChange,
      value: undefined,
    });
  },

  mountWrapper: function(inst, props) {
    if (__DEV__) {
      checkSelectPropTypes(inst, props);
      warnIfValueIsNull(props);
    }

    var value = LinkedValueUtils.getValue(props);
    inst._wrapperState = {
      pendingUpdate: false,
      initialValue: value != null ? value : props.defaultValue,
      listeners: null,
      onChange: _handleChange.bind(inst),
      wasMultiple: Boolean(props.multiple),
    };
  },

  getSelectValueContext: function(inst) {
    // ReactDOMOption looks at this initial value so the initial generated
    // markup has correct `selected` attributes
    return inst._wrapperState.initialValue;
  },

  postUpdateWrapper: function(inst) {
    var props = inst._currentElement.props;
    if (__DEV__) {
      warnIfValueIsNull(props);
    }

    // After the initial mount, we control selected-ness manually so don't pass
    // this value down
    inst._wrapperState.initialValue = undefined;

    var wasMultiple = inst._wrapperState.wasMultiple;
    inst._wrapperState.wasMultiple = Boolean(props.multiple);

    var value = LinkedValueUtils.getValue(props);
    if (value != null) {
      inst._wrapperState.pendingUpdate = false;
      updateOptions(inst, Boolean(props.multiple), value);
    } else if (wasMultiple !== Boolean(props.multiple)) {
      // For simplicity, reapply `defaultValue` if `multiple` is toggled.
      if (props.defaultValue != null) {
        updateOptions(inst, Boolean(props.multiple), props.defaultValue);
      } else {
        // Revert the select back to its default unselected state.
        updateOptions(inst, Boolean(props.multiple), props.multiple ? [] : '');
      }
    }
  },
};

function _handleChange(event) {
  var props = this._currentElement.props;
  var returnValue = LinkedValueUtils.executeOnChange(props, event);

  this._wrapperState.pendingUpdate = true;
  ReactUpdates.asap(updateOptionsIfPendingUpdateAndMounted, this);
  return returnValue;
}

module.exports = ReactDOMSelect;
