/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

// Shortcuts to DOM Elements.
var recentWaterSection = document.getElementById('recent-water-list');
var signInButton = document.getElementById('sign-in-button');
var loadDataButton = document.getElementById('load-data-button');
var listeningFirebaseRefs = [];

function startDatabaseQueries() {
    const plantsRef = firebase.database().ref("plants");

    plantsRef.once("value", function(snap) {
	    var ul = d3.select('#plantlist');

	    ul.selectAll('li')
	        .data(Object.keys(snap.val()))
	        .enter()
	        .append('li')
	        .html(String);
    });

    const logsRef = firebase.database().ref('plants/uuid2462abf3ae5c/logs').limitToLast(1000);
    
    logsRef.once("value", function(snapshot) {
        var tmp = Object.values(snapshot.val())
        tmp.forEach(function(d){ d.timestamp = new Date(d.timestamp * 1000) });
        buildLineGraph(tmp);
    }, function (error) {
        console.log("Error: " + error.code);
    });

    listeningFirebaseRefs.push(logsRef, plantsRef);
}

var currentUID;

/**
 * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
 */
function onAuthStateChanged(user) {
  // We ignore token refresh events.
  if (user && currentUID === user.uid) {
    return;
  }

  if (user) {
    currentUID = user.uid;
  } else {
    // Set currentUID to null.
    currentUID = null;
  }
}

window.addEventListener('load', function() {
  // Bind Sign in button.
  signInButton.addEventListener('click', function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
  });
  loadDataButton.addEventListener('click', function() {
    //startDatabaseQueries();
  });

  // Listen for auth state changes
  firebase.auth().onAuthStateChanged(onAuthStateChanged);
}, false);


startDatabaseQueries();

/**
 * Visualisation 
 */

// dimensions and margins
const margin = {top: 20, right: 30, bottom: 30, left: 40}
const width = 900 - margin.left - margin.right, height = 400 - margin.top - margin.bottom;

// append the svg object 
const svg = d3
    .select("#graph")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

const graph = svg
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

const xScale = d3.scaleTime().range([0, width])
const yScale = d3.scaleLinear().range([height, 0])

const xAxis = svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(50,${height + margin.bottom})`)
        
const yAxis = svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left},0)`)

const pathLight = graph
    .append('g')
    .append("path")  
    .attr('fill', 'none')
    .attr('stroke', '#ef6c00')
    .attr('stroke-width', 1)

const pathWater = graph
    .append('g')
    .append("path")  
    .attr('fill', 'none')
    .attr('stroke', '#0288d1')
    .attr('stroke-width', 1)

/** 
* Some simple application logic
*/
function buildLineGraph(data) {
    console.log('building graph');
    console.log(data);

    const lineLight = d3.line()
        .defined(d => !isNaN(d.light))
        .x(d => xScale(d.timestamp))
        .y(d => yScale(d.light))

    const lineWater = d3.line()
        .defined(d => !isNaN(d.water))
        .x(d => xScale(d.timestamp))
        .y(d => yScale(d.water))

    xScale.domain(d3.extent(data, d => d.timestamp))
    yScale.domain(d3.extent(data, d => d.light))

    xAxis
        .call(d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat("%a %H:%M"))
        .ticks(width / 80).tickSizeOuter(0))

    yAxis
        .call(d3.axisLeft(yScale))
        .call(g => g.select(".domain").remove())
        .call(g => g.select(".tick:last-of-type text").clone())

    pathLight
        .datum(data)
        .attr('d', lineLight)    

    pathWater
        .datum(data)
        .attr('d', lineWater)            
}