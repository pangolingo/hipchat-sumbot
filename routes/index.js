var http = require('request');
var cors = require('cors');
var uuid = require('uuid');
var url = require('url');
var RSVP = require('rsvp');
var AlchemyLanguageV1 = require('watson-developer-cloud/alchemy-language/v1');

const bluemixCredentials = {
  "url": "https://gateway-a.watsonplatform.net/calls",
  "note": "It may take up to 5 minutes for this key to become active",
  "apikey": "c1b8c4236f33086d91c4c70cc935c91b5ec3a052"
};

var alchemy_language = new AlchemyLanguageV1({
  api_key: bluemixCredentials.apikey
});


function cleanRoomHistory(data){
    var messages = data.body.items.filter(function(msg){
      return msg.type === 'message'
    }).map(function(msg){
      return msg.message;
    });
    return messages;
}

function analyzeChats(messages){
  return new RSVP.Promise(function(resolve, reject) {


    console.log(`Analyzing ${messages.length} messages`);
    // console.log(messages);

    // run the analysis
    var parameters = {
      //extract: 'entity,keyword,taxonomy,concept,doc-emotion', // these should mostly be the default ones
      extract: 'keyword,concept,doc-emotion', // only the ones we use
      text: messages.join("\n"),
      sentiment: 1,
    };    
    // this is a combined analysis which means it can extract multiple things
    alchemy_language.combined(parameters, function (err, response) {
      if (err){
        console.log('error:', err);
        // reject the promise
        reject(err);
      } else {
        console.log(response);
        var bestEmotion = sortEmotionsByRelevance(response.docEmotions).pop().name;
        var sortedConcepts = sortConceptsOrKeywordsByRelevance(response.concepts);
        if(sortedConcepts.length < 1){
          // if there are no concepts, use keywords
          var sortedConcepts = sortConceptsOrKeywordsByRelevance(response.keywords);
        }
        var bestTopic = sortedConcepts.pop().text;
        console.log(bestTopic);
        // resolve the promise
        resolve({
          topic: bestTopic,
          emotion: bestEmotion
        });
      }
    });

  });

}

function sortConceptsOrKeywordsByRelevance(concepts){
  if(!concepts || concepts.length < 1){
    return [];
  }
  var concepts2 = concepts.sort(function(a,b){
    return parseFloat(a.relevance) > parseFloat(b.relevance)
  });
  return concepts2;
}

function sortEmotionsByRelevance(emotionsHash){
  // convert the hash into an array
  var emotionsArr = [];
  for(var key in emotionsHash){
    emotionsArr.push({
      name: key,
      relevance: parseFloat(emotionsHash[key])
    });
  }
  // sort the array
  var emotionsArr2 = emotionsArr.sort(function(a, b){
    return a.relevance > b.relevance
  });
  return emotionsArr2;
}

function getEmotionDetails(emotionStr){
  var emotions = [
    { name: 'anger', text: "angry", icon: "angry.gif" },
    { name: 'disgust', text: "disgusted", icon: "horrified.png" },
    { name: 'fear', text: "scared", icon: "scared.gif" },
    { name: 'joy', text: "happy", icon: "happy.gif" },
    { name: 'sadness', text: "sad", icon: "sad.gif" },
  ];
  return emotions.find(function(e){
    return e.name === emotionStr
  })
}

function buildGlance(addon, analysis){
  var emotionDetails;
  if(!analysis){
    emotionDetails = { name: null, text: "loading", icon: "loading.gif" }
    analysis = {
      emotion: null,
      topic: "Analysing..."
    }
  } else {
    emotionDetails = getEmotionDetails(analysis.emotion);
  }
  var glanceData = {
        "label": {
          "type": "html",
          // "value": `We&rsquo;re ${emotionDetails.text}`
          "value": `Topic: ${analysis.topic}`
        },
        "status": {
          "type": "icon",
          "value": {
            "url": `${addon.descriptor.links.homepage}/img/emotes/${emotionDetails.icon}`,
            "url@2x": `${addon.descriptor.links.homepage}/img/emotes/${emotionDetails.icon}`
          }
        }
      };
      return glanceData;
}

// This is the heart of your HipChat Connect add-on. For more information,
// take a look at https://developer.atlassian.com/hipchat/tutorials/getting-started-with-atlassian-connect-express-node-js
module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);

  // simple healthcheck
  app.get('/healthcheck', function (req, res) {
    res.send('OK');
  });

  // Root route. This route will serve the `addon.json` unless a homepage URL is
  // specified in `addon.json`.
  app.get('/',
    function (req, res) {
      // Use content-type negotiation to choose the best way to respond
      res.format({
        // If the request content-type is text-html, it will decide which to serve up
        'text/html': function () {
          var homepage = url.parse(addon.descriptor.links.homepage);
          if (homepage.hostname === req.hostname && homepage.path === req.path) {
            res.render('homepage', addon.descriptor);
          } else {
            res.redirect(addon.descriptor.links.homepage);
          }
        },
        // This logic is here to make sure that the `addon.json` is always
        // served up when requested by the host
        'application/json': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
    );

  // This is an example route that's used by the default for the configuration page
  // https://developer.atlassian.com/hipchat/guide/configuration-page
  app.get('/config',
    // Authenticates the request using the JWT token in the request
    addon.authenticate(),
    function (req, res) {
      // The `addon.authenticate()` middleware populates the following:
      // * req.clientInfo: useful information about the add-on client such as the
      //   clientKey, oauth info, and HipChat account info
      // * req.context: contains the context data accompanying the request like
      //   the roomId
      res.render('config', req.context);
    }
    );

  // This is an example glance that shows in the sidebar
  // https://developer.atlassian.com/hipchat/guide/glances
  app.get('/glance',
    cors(),
    addon.authenticate(),
    function (req, res) {
      res.json(buildGlance(addon));
    }
    );

  // This is an example end-point that you can POST to to update the glance info
  // Room update API: https://www.hipchat.com/docs/apiv2/method/room_addon_ui_update
  // Group update API: https://www.hipchat.com/docs/apiv2/method/addon_ui_update
  // User update API: https://www.hipchat.com/docs/apiv2/method/user_addon_ui_update
  app.post('/update_glance',
    cors(),
    addon.authenticate(),
    function (req, res) {
      res.json(buildGlance(addon));
    }
    );

  // This is an example sidebar controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/dialog-and-sidebar-views/sidebar
  app.get('/sidebar',
    addon.authenticate(),
    function (req, res) {
      res.render('sidebar', {
        identity: req.identity
      });
    }
    );

  // Sample endpoint to send a card notification back into the chat room
  // See https://developer.atlassian.com/hipchat/guide/sending-messages
  app.post('/send_notification',
    addon.authenticate(),
    function (req, res) {
      var card = {
        "style": "link",
        "url": "https://www.hipchat.com",
        "id": uuid.v4(),
        "title": req.body.messageTitle,
        "description": "Great teams use HipChat: Group and private chat, file sharing, and integrations",
        "icon": {
          "url": "https://hipchat-public-m5.atlassian.com/assets/img/hipchat/bookmark-icons/favicon-192x192.png"
        }
      };
      var msg = '<b>' + card.title + '</b>: ' + card.description;
      var opts = { 'options': { 'color': 'yellow' } };
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, msg, opts, card);
      res.json({ status: "ok" });
    }
    );

  // This is an example route to handle an incoming webhook
  // https://developer.atlassian.com/hipchat/guide/webhooks
  app.post('/webhook',
    addon.authenticate(),
    function (req, res) {
      // show progress
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, 'Summarizing...');
      var glance = buildGlance(addon);
      hipchat.updateGlance(req.clientInfo, req.identity.roomId, 'sample.glance', glance);
      res.sendStatus(200);

      // run analysis
      hipchat.getRoomHistory(req.clientInfo, req.identity.roomId)
        .then(cleanRoomHistory)
        .then(analyzeChats)
        .then(function(result){
          var glance = buildGlance(addon, result);
          hipchat.updateGlance(req.clientInfo, req.identity.roomId, 'sample.glance', glance);
          hipchat.sendMessage(req.clientInfo, req.identity.roomId, JSON.stringify(result))
        })
        .catch(function(error) {
          console.log(errror);
        });
    }
  );

  // Notify the room that the add-on was installed. To learn more about
  // Connect's install flow, check out:
  // https://developer.atlassian.com/hipchat/guide/installation-flow
  addon.on('installed', function (clientKey, clientInfo, req) {
    hipchat.sendMessage(clientInfo, req.body.roomId, 'The ' + addon.descriptor.name + ' add-on has been installed in this room');
  });

  // Clean up clients when uninstalled
  addon.on('uninstalled', function (id) {
    addon.settings.client.keys(id + ':*', function (err, rep) {
      rep.forEach(function (k) {
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });

};
