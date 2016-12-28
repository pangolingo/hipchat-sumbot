/* jshint node: true */

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

hipchat.settings.getAllClientInfos()
  .then(function(clientInfos){
    if(clientInfos.length < 1){
      console.log('no client info in Redis');
      console.log('done');
      process.exit();
      return;
    }
    var clientInfo = clientInfos[0];


      // run analysis
hipchatMethods.getRoomHistory(clientInfo, clientInfo.roomId)
  .then(sumbot.cleanRoomHistory)
  .then(sumbot.analyzeChats)
  .then(function(result){
    var glance = sumbot.buildGlance(addon, result);

    console.log('updating glance');
    var p1 = hipchatMethods.updateGlance(clientInfo, clientInfo.roomId, 'sample.glance', glance);
    // console.log('sending message');
    // var p2 = hipchatMethods.sendMessage(clientInfo, clientInfo.roomId, JSON.stringify(result));
    
    RSVP.all([p1]).then(function(resultsArray) {
      // posts contains an array of results for the given promises
      console.log('done');
      process.exit();
    }).catch(function(error){
      // if any of the promises fails.
      console.log(error);
      process.exit();
    });

  })
  .catch(function(error) {
    console.log(error);
    process.exit();
  });
  // .always(function(){
  //     console.log('done');
  // });



  });
  

// process.exit()