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
const COUNT_ARGUMENT = 'num';
const USER = 'rohitvarkey';


exports.workout_diary_step = functions.https.onRequest((request, response) => {
  const app = new App({request, response});
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));
  console.log(app.getUser());

// c. The function that generates the silly name
    function startNewUserWorkout(app, workout_type, completed) {
        console.log("Tracking new user activity");
        let trackUpdateRef = db.ref("last_activity/" + USER);
        trackUpdateRef.set({
            "last_done" : {
                "workout_type": workout_type,
                "completed": completed,
            }
        });
    }

    function trackLastUserActivity(app, workout_type, completed, step, exercise, lastRep) {
      console.log("Tracking last user activity");
      let trackUpdateRef = db.ref("last_activity/" + USER);
      trackUpdateRef.update({
            "last_done/workout_type": workout_type,
            "last_done/completed": completed,
      });
      if (exercise != null) {
          let exerciseRef = db.ref("last_activity/" + USER + "/exercises/" + step);
          exerciseRef.update({
              'exercise': exercise,
              'lastRep': lastRep
          })
      }
    }

  function makeResponse (app) {
    console.log("Invoked");
    let workout_type = app.getArgument(WORKOUT_ARGUMENT);
    let step = eval(app.getArgument(STEP_ARGUMENT));
    let exercise_str = "";
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
        trackLastUserActivity(app, workout_type, true, step);
        let exerciseRef = db.ref("last_activity/" + USER + "/exercises");
        exerciseRef.orderByKey().on('value', function (snapshot) {
            snapshot.forEach(function(data) {
                let val = data.val()
                exercise_str += val['lastRep'] + ' ' + val['exercise'] + ', ';
            })
            app.tell(
                "Awesome! You're done for the day! You did " + exercise_str +
                "! Great work. See you tomorrow."
            )
        });
        return;
      }
      let reps = val['reps'];
      let exercise = val['exercise'];
      trackLastUserActivity(app, workout_type, false, step, exercise, 0);
      app.ask('Alright, your next exercise is ' + reps +
        ' reps of ' + exercise + '. You can do it!');
    })
  }

  function logCounts (app) {
    console.log("count invoked");
    let workout_type = app.getArgument(WORKOUT_ARGUMENT);
    let step = eval(app.getArgument(STEP_ARGUMENT));
    let counts = app.getArgument(COUNT_ARGUMENT);
    /*let counts = countsOriginal.map(Number);
    if (counts[counts.length - 1] == NaN) {
        counts.splice(counts.length - 1, 1)
        countsOriginal[countsOriginal.length - 1].split(" ").map(Number)
        counts.push();
        console.log("Modded", counts);
    }*/
    let max_count = Math.max(...counts);
    //let step = 1;
    if (step == null) {
        step = 1
    }
    if (workout_type == null) {
        workout_type = 'Monday'
    }
    console.log("Invoked with ", workout_type, step, USER, counts);
    var ref = db.ref("users/" + USER + '/' + workout_type +'/' + step);
    console.log("users/" + USER + '/' + workout_type +'/' + step);
    console.log("Ref", ref);
    ref.on('value', function(snapshot) {
      console.log("snapshot:", snapshot);
      console.log("Val", snapshot.val());
      let val = snapshot.val();
      if (val == null) {
        app.tell("Something went wrong.");
        return;
      }
      let reps = val['reps'];
      let exercise = val['exercise'];
      let diff = reps - max_count;
      if (max_count < reps) {
        trackLastUserActivity(app, workout_type, false, step, exercise, max_count);
        app.ask('You have' + diff + 'reps left for' + exercise + '. Would you like to skip or continue?');
      }
      else {
        trackLastUserActivity(app, workout_type, false, step, exercise, reps);
        app.ask('Well done! You completed ' + max_count + ' ' + exercise + '. Say done to start the next exercise.');
      }
    })
  }

  function summary(app) {
    console.log("summary invoked");
    let workout_type = app.getArgument(WORKOUT_ARGUMENT);
    if (workout_type == null) {
        workout_type = 'Monday'
    }
    console.log("Invoked with ", workout_type, USER);
    var ref = db.ref("users/" + USER + '/' + workout_type);
    console.log("users/" + USER + '/' + workout_type);
    console.log("Ref", ref);
    let summary_str = "Your " + workout_type + " workout consists of ";
    ref.orderByKey().on('value', function(snapshot) {
      console.log("snapshot:", snapshot);
        snapshot.forEach(function(exercise_snapshot) {
            console.log("Val", exercise_snapshot.val());
            let val = exercise_snapshot.val();
            if (val == null) {
                app.tell("Something went wrong.");
                return;
            }
            let reps = val['reps'];
            let exercise = val['exercise'];
            summary_str += reps + " " + exercise + ", ";
            console.log(summary_str);
        });
        summary_str += ". Tell me when you want to begin!"
        startNewUserWorkout(app, workout_type, false);
        app.ask(summary_str);
    });
  }

  function endSummary (app) {
      let workoutRef = db.ref("last_activity/" + USER + "/last_done");
      let summary_details = {}
      let exercise_str = "";
      let waitCallbacks = 2;
      workoutRef.on('value', function(snapshot){
          let val = snapshot.val();
          summary_details['workout_type'] = val['workout_type'];
          summary_details['completed'] = val['completed'];
          waitCallbacks -=1;
          if (waitCallbacks == 0){
              app.tell(
                  "Your last workout was the " +
                  summary_details["workout_type"] +
                  ". It consisted of " +
                  exercise_str + " ."
              )
          }
      });

      let exerciseRef = db.ref("last_activity/" + USER + "/exercises");
      exerciseRef.orderByKey().on('value', function (snapshot) {
          snapshot.forEach(function(data) {
              let val = data.val()
              exercise_str += val['lastRep'] + ' ' + val['exercise'] + ', ';
          })
          waitCallbacks -=1;
          if (waitCallbacks == 0){
              app.tell(
                  "Your last workout was the " +
                  summary_details["workout_type"] +
                  ". It consisted of " +
                  exercise_str + " ."
              )
          }
      })
  }

  function getOptions(app) {
    var ref = db.ref("users/" + USER + '/');
    let workout_str = "Your available workouts are ";
    ref.orderByKey().on('value', function(snapshot) {
        snapshot.forEach(function(data) {
            workout_str += data.key + ', ';
        })
        app.ask(workout_str)
    })
  }
  // d. build an action map, which maps intent names to functions
  let actionMap = new Map();
  actionMap.set(NAME_ACTION, makeResponse);
  actionMap.set('count', logCounts);
  actionMap.set('summary', summary);
  actionMap.set('end', endSummary);
  actionMap.set('options', getOptions);



app.handleRequest(actionMap);
});
