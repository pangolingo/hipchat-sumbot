/* jshint node: true */

// this script is run by a Heroku cron job

// [Express](http://expressjs.com/) is your friend -- it's the underlying
// web framework that `atlassian-connect-express` uses
var express = require('express');

var RSVP = require('rsvp');

// You need to load `atlassian-connect-express` to use her godly powers
var ac = require('atlassian-connect-express');
process.env.PWD = process.env.PWD || process.cwd(); // Fix expiry on Windows :(

// Let's use Redis to store our data
ac.store.register('redis', require('atlassian-connect-express-redis'));


// Bootstrap Express
var app = express();

// Bootstrap the `atlassian-connect-express` library
var addon = ac(app);

// Declares the environment to use in `config.js`
var devEnv = app.get('env') == 'development';

// Load the HipChat AC compat layer
var hipchat = require('atlassian-connect-express-hipchat')(addon, app);

var hipchatMethods = require('./lib/hipchat')(addon);

var sumbot = require('./lib/sumbot');
var magicRunAnalysis = require('./lib/magic-run-analysis');





// needs hipchat.settings, hipchatMethods, sumbot


magicRunAnalysis(hipchat.settings, hipchatMethods, sumbot, function(clientInfo, result){
  var filtered = sumbot.filterAnalysis(result);
  var glance = sumbot.buildGlance(addon, filtered);

  console.log('updating glance');
  // we use an array in case we want to do other things
  var p1 = hipchatMethods.updateGlance(clientInfo, clientInfo.roomId, 'sample.glance', glance);
  RSVP.all([p1]).then(function(resultsArray) {
    // posts contains an array of results for the given promises
    console.log('done');
    process.exit();
  }).catch(function(error){
    // if any of the promises fails.
    console.log(error);
    process.exit();
  });

});