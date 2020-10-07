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
const recentWaterSection = document.getElementById('recent-water-list')
const signInButton = document.getElementById('sign-in-button')
const loadDataButton = document.getElementById('load-data-button')
const listeningFirebaseRefs = []
const lightRange = [1500,4000]
const waterRange = [500,3000]
const uuid = 'uuid2462abf3ae5c'

function startDatabaseQueries() {
    const plantsRef = firebase.database().ref("plants");
    
    plantsRef.once("value", function(snap) {
        const plantList = document.getElementById("plant-list");
	    for(const plant of Object.keys(snap.val())) {
            const navLink = document.createElement("a");
            navLink.className = "mdl-navigation__link";
            const icon = document.createElement("i");
            icon.className = "plant-icon mdl-color-text--blue-grey-400 material-icons";
            icon.innerHTML = "local_florist";
            const name = document.createElement("span");
            name.textContent = plant;
            navLink.appendChild(icon);
            navLink.appendChild(name);
            plantList.appendChild(navLink);
        }
    });

    const currentRef = firebase.database().ref(`plants/${uuid}/last_update`)

    currentRef.once("value", function(snapshot) {
        drawDonuts(snapshot.val());
    });

    const logsRef = firebase.database().ref(`plants/${uuid}/logs`).limitToLast(500);
    
    logsRef.on("value", function(snapshot) {
        var tmp = Object.values(snapshot.val())

        tmp.forEach(function(d){ 
            d.timestamp = new Date(d.timestamp * 1000) 
            d.light_perc = ((d.light - lightRange[0]) * 100) / (lightRange[1] - lightRange[0])
            d.water_perc = ((d.water - waterRange[0]) * 100) / (waterRange[1] - waterRange[0])
        });

        updateLines(tmp)
    }, function (error) {
        console.log("Error: " + error.code);
    });

    listeningFirebaseRefs.push(logsRef, plantsRef, currentRef);
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
      document.querySelector("img.user-avatar").src = `${user.photoURL}=s48`;
      document.querySelector("div.user-email").innerHTML = user.email;
      document.getElementById("logged-in").classList.remove("hidden");
      document.getElementById("logged-out").classList.add("hidden");
    } else {
      // Set currentUID to null.
      currentUID = null;
      document.querySelector("img.user-avatar").src = '';
      document.querySelector("div.user-email").innerHTML = '';
      document.getElementById("logged-in").classList.add("hidden");
      document.getElementById("logged-out").classList.remove("hidden");
    }
  }
window.addEventListener('load', function() {
  // Bind Sign in button.
  const provider = new firebase.auth.GoogleAuthProvider();
  signInButton.addEventListener('click', () => {
    firebase.auth().signInWithPopup(provider);
  });
  // Listen for auth state changes
  firebase.auth().onAuthStateChanged(onAuthStateChanged);
}, false);

startDatabaseQueries();       


/**
 * Visualisation 
 */
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
const yScaleLight = d3.scaleLinear().range([height, 0])
const yScaleWater = d3.scaleLinear().range([height, 0])

const xAxisGroup = svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(50,${height + margin.bottom})`)
        
const yAxisLight = svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left}, ${margin.top})`)

const yAxisWater = svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${width + margin.left}, ${margin.top})`)

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

const lineLight = d3.line()
    .defined(d => !isNaN(d.light))
    .x(d => xScale(d.timestamp))
    .y(d => yScaleLight(d.light_perc))
    .curve(d3.curveMonotoneX) 

const lineWater = d3.line()
    .defined(d => !isNaN(d.water))
    .x(d => xScale(d.timestamp))
    .y(d => yScaleWater(d.water_perc))
    .curve(d3.curveMonotoneX)     

/** 
* Some simple application logic
*/

const updateLines = data => {
    console.log('Updating line data');
    console.log(data)

    xScale.domain(d3.extent(data, d => d.timestamp))
    yScaleLight.domain([0, 100])
    yScaleWater.domain([0, 100])

    xAxisGroup
        .call(d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat("%a %H:%M"))
        .ticks(width / 80).tickSizeOuter(0))

    yAxisLight
        .call(d3.axisLeft(yScaleLight))
        .call(g => g.select(".domain").remove())
        .call(g => g.select(".tick:last-of-type text").clone())

    yAxisWater
        .call(d3.axisRight(yScaleWater))
        .call(g => g.select(".domain").remove())
        .call(g => g.select(".tick:last-of-type text").clone())

    pathLight
        .datum(data)
        .attr('d', lineLight)    

    pathWater
        .datum(data)
        .attr('d', lineWater)   
}

const updateDonuts = data => {

}

function drawDonuts(data) {
    const donutDims = {width: 180, height: 180, radius: 90, hole: 40}
        console.log(data)
    const t = [{type: 'water', value: 80},{type: 'light', value: 20}]

    const colors = ['#64b5f6', '#eeeeee', '#616161', '#ff9b83']

    const colorScale = d3.scaleOrdinal( t.map(d => d.type), colors )

    const pie = d3.pie()
        .padAngle(0.005)
        .sort(null)
        .value(d => d.value)
    const pieArcs = pie(t);

    const arc = d3.arc()
        .innerRadius(donutDims.radius - donutDims.hole)
        .outerRadius(donutDims.radius);

    const svg = d3.select('#donut-water')
        .append('svg')
        .attr('width', donutDims.width)
        .attr('height', donutDims.height)

    const donutgroup = svg.append('g')
        .attr('class', 'donut-container')
        .attr('transform', `translate(${ donutDims.width / 2 },${ donutDims.height / 2 })`)
        
    donutgroup.selectAll('path')
        .data(pieArcs)
        .join('path')
            .style('stroke', 'white')
            .style('stroke-width', 2)
            .style('fill', d => colorScale( d.data.type ))
            .attr('d', arc)

  	donutgroup.selectAll("text")
  	  .data([t])
  	  .join("text")
  	  .attr("text-anchor", "middle")
  	  .attr("dy", ".3em")
  	  .style("font", "10px sans-serif")
  	  .style("max-width", "100%")
  	  .style("height", "auto")
  	  .attr("text-anchor", "middle")
  	  .attr("fill", '#616161')
  	  .text( d => d[0].value + "%")
  	  .attr("transform", `scale(${ (donutDims.radius - donutDims.hole)/15 })`);

}