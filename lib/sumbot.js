/* jshint node: true */

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

var cleanRoomHistory = function(data){
    var messages = data.body.items.filter(function(msg){
      return msg.type === 'message';
    }).map(function(msg){
      return msg.message;
    });
    return messages;
};

var analyzeChats = function(messages){
  return new RSVP.Promise(function(resolve, reject) {


    console.log(`Analyzing ${messages.length} messages`);
    // console.log(messages);

    // run the analysis
    var parameters = {
      //extract: 'entity,keyword,taxonomy,concept,doc-emotion', // these should mostly be the default ones
      extract: 'keyword,concept,doc-emotion', // only the ones we use
      text: messages.join("\n"),
      // sentiment: 1,
    };
    // this is a combined analysis which means it can extract multiple things
    alchemy_language.combined(parameters, function (err, response) {
      if (err){
        console.log('error:', err);
        // reject the promise
        reject(err);
      } else {
        console.log(response);
        resolve(response);
      }
    });

  });

};


var filterAnalysis = function(analysis){
  var bestEmotion = sortEmotionsByRelevance(analysis.docEmotions).pop().name;
  // var sortedConcepts = sortConceptsOrKeywordsByRelevance(analysis.concepts);
  // if(sortedConcepts.length < 1){
  //   // if there are no concepts, use keywords
  //   var sortedConcepts = sortConceptsOrKeywordsByRelevance(analysis.keywords);
  // }
  var randomTopic = getRandomGoodConceptOrKeyword(analysis.concepts);
  if(!randomTopic){
    randomTopic = getRandomGoodConceptOrKeyword(analysis.keywords);
  }
  // var bestTopic = sortedConcepts.pop().text;
  console.log(randomTopic);
  // resolve the promise
  return {
    topic: randomTopic.text,
    emotion: bestEmotion
  };
}

var getRandomGoodConceptOrKeyword = function(concepts){
  if(!concepts || concepts.length < 1){
    return null;
  }
  var goodConcepts = concepts.filter(function(a){
    return parseFloat(a.relevance) > 0.5;
  });
  var randomConcept = goodConcepts[Math.floor(Math.random()*goodConcepts.length)];
  return randomConcept;
};

var sortConceptsOrKeywordsByRelevance = function(concepts){
  if(!concepts || concepts.length < 1){
    return [];
  }
  var concepts2 = concepts.sort(function(a,b){
    return parseFloat(a.relevance) > parseFloat(b.relevance);
  });
  return concepts2;
};

var sortEmotionsByRelevance = function(emotionsHash){
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
    return a.relevance > b.relevance;
  });
  return emotionsArr2;
};

var getEmotionDetails = function(emotionStr){
  var emotions = [
    { name: 'anger', text: "angry", icon: "angry.gif" },
    { name: 'disgust', text: "disgusted", icon: "horrified.png" },
    { name: 'fear', text: "scared", icon: "scared.gif" },
    { name: 'joy', text: "happy", icon: "happy.gif" },
    { name: 'sadness', text: "sad", icon: "sad.gif" },
  ];
  return emotions.find(function(e){
    return e.name === emotionStr;
  });
};

var buildGlance = function(addon, analysis){
  var emotionDetails;
  if(!analysis){
    emotionDetails = { name: null, text: "loading", icon: "loading.gif" };
    analysis = {
      emotion: null,
      topic: "Analysing..."
    };
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
};



module.exports = {
  buildGlance: buildGlance,
  // getEmotionDetails: getEmotionDetails,
  // sortEmotionsByRelevance: sortEmotionsByRelevance,
  cleanRoomHistory: cleanRoomHistory,
  analyzeChats: analyzeChats,
  filterAnalysis: filterAnalysis,
  // getRandomGoodConceptOrKeyword: getRandomGoodConceptOrKeyword,
  // sortConceptsOrKeywordsByRelevance: sortConceptsOrKeywordsByRelevance
};