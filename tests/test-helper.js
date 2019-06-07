import Ember from 'ember';
import Application from '../app';
import config from '../config/environment';
import { setApplication } from '@ember/test-helpers';
import { start } from 'ember-qunit';

setApplication(Application.create(config.APP));

start();

// on Ember < 2.18 the ember-qunit QUnitAdapter will have an `exception` method
// that logs errors and throws them async _without_ going through Ember.onerror,
// which means tests confirming assertions and what not are very difficult to
// write
//
// this snippet ensures that _all_ versions throw synchronously **and** honors
// Ember.onerror if setup, and therefore ensures that errors can be
// consistently caught from Ember 2.8 through current (3.10)
if (typeof Ember.Test.adapter.exception === 'function') {
  Ember.Test.adapter.exception = function(error) {
    if (Ember.onerror) {
      Ember.onerror(error);
    } else {
      throw error;
    }
  };
}
