var magicRunAnalysis = function(hipchatSettings, hipchatMethods, sumbot, callback){
  hipchatSettings.getFirstClientInfo()
    .then(function(clientInfo){
      // run analysis
      hipchatMethods.getRoomHistory(clientInfo, clientInfo.roomId)
        .then(sumbot.cleanRoomHistory)
        .then(sumbot.analyzeChats)
        .then(callback.bind(this, clientInfo))
        .catch(function(error) {
          console.log(error);
          process.exit();
        });
    });
}

module.exports = magicRunAnalysis;