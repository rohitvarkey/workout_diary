'use strict';

process.env.DEBUG = 'actions-on-google:*';
const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);
var db = admin.database();


// a. the action name from the make_name Dialogflow intent
const NAME_ACTION = 'activity';
// b. the parameters that are parsed from the make_name intent
const STEP_ARGUMENT = 'track';
const WORKOUT_ARGUMENT = 'workout';
const USER = 'rohitvarkey';


exports.workout_diary_step = functions.https.onRequest((request, response) => {
  const app = new App({request, response});
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

// c. The function that generates the silly name
  function makeResponse (app) {
    console.log("Invoked");
    let workout_type = app.getArgument(WORKOUT_ARGUMENT);
    let step = eval(app.getArgument(STEP_ARGUMENT));
    //let step = 1;
    if (step == null) {
        step = 1
    }
    if (workout_type == null) {
        workout_type = 'Monday'
    }
    console.log("Invoked with ", workout_type, step, USER);
    var ref = db.ref("users/" + USER + '/' + workout_type +'/' + step);
    console.log("users/" + USER + '/' + workout_type +'/' + step);
    console.log("Ref", ref);
    ref.on('value', function(snapshot) {
      console.log("snapshot:", snapshot);
      console.log("Val", snapshot.val());
      let val = snapshot.val();
      if (val == null) {
        app.tell("Awesome! You're done for the day Great work");
        return;
      }
      let reps = val['reps'];
      let exercise = val['exercise'];
      app.ask('Alright, your next exercise is ' + reps +
        ' reps of ' + exercise + '. You can do it!');
    })
  }
  // d. build an action map, which maps intent names to functions
  let actionMap = new Map();
  actionMap.set(NAME_ACTION, makeResponse);


app.handleRequest(actionMap);
});
