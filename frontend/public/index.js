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
const plantList = document.getElementById("plant-list");
let lightRange = [0,4095];
let waterRange = [4095, 0];
let listeningFirebaseRefs = [];

function startDatabaseQueries() {
    getPlants().then((firstPlant) => {
       setAndTrackPlant(firstPlant);
    }).catch((error) => {
        console.log('Error getting plants.');
    });
}

function changePlant(event) {
    console.log(event);
    const uuid = event.target.getAttribute('uuid');
    console.log(`Change to plant: ${uuid}`);
    setAndTrackPlant(uuid);
}

function configButton(event) {
    event.stopPropagation();
    console.log(event);
    const config = {
        uuid: event.target.getAttribute('uuid'),
        name: event.target.getAttribute('name'),
        waterMin: event.target.getAttribute('waterMin'),
        waterMax: event.target.getAttribute('waterMax'),
        lightMin: event.target.getAttribute('lightMin'),
        lightMax: event.target.getAttribute('lightMax')
    };

    console.log(`Plant to config: ${config.uuid}`);
    console.log(config);

    document.getElementById("config-plant-uuid").value = config.uuid;
    document.getElementById("config-plant-name").value = config.name;
    document.getElementById("config-water-min").value = config.waterMin;
    document.getElementById("config-water-max").value = config.waterMax;
    document.getElementById("config-light-min").value = config.lightMin;
    document.getElementById("config-light-max").value = config.lightMax;

    document.getElementById("config-plant-name").parentElement.classList.add('is-dirty');
    document.getElementById("config-water-min").parentElement.classList.add('is-dirty');
    document.getElementById("config-water-max").parentElement.classList.add('is-dirty');
    document.getElementById("config-light-min").parentElement.classList.add('is-dirty');
    document.getElementById("config-light-max").parentElement.classList.add('is-dirty');

    document.getElementById('plant-config-dialog').showModal();
}

function savePlantConfig() {
    console.log('Save Plant Config');

    const config = {
        uuid: document.getElementById("config-plant-uuid").value,
        name: document.getElementById("config-plant-name").value,
        waterMin: document.getElementById("config-water-min").value,
        waterMax: document.getElementById("config-water-max").value,
        lightMin: document.getElementById("config-light-min").value,
        lightMax: document.getElementById("config-light-max").value
    };

    setConfigAttributes(document.getElementById(`plant-button-${config.uuid}`), config);
    setConfigAttributes(document.getElementById(`plant-icon-${config.uuid}`), config);
    setConfigAttributes(document.getElementById(`plant-name-${config.uuid}`), config);
    setConfigAttributes(document.getElementById(`plant-settings-${config.uuid}`), config);

    const plantConfigRef = firebase.database().ref(`plants/${config.uuid}/config`);
    plantConfigRef.set(config);
    lightRange = [config.lightMin, config.lightMax];
    waterRange = [config.waterMax, config.waterMin];
    document.getElementById(`plant-name-${config.uuid}`).textContent = config.name;
    document.getElementById('plant-config-dialog').close();
}

let logsRef;
function setAndTrackPlant(uuid) {
    const currentRef = firebase.database().ref(`plants/${uuid}/last_update`);
    try {
        logsRef.off('value');
    } catch (error) {
        console.log(error);
    }
    logsRef = firebase.database().ref(`plants/${uuid}/logs`).limitToLast(500);
    logsRef.on("value", updateCharts, (error) => {
        console.log("Error: " + error.code);
    });
    listeningFirebaseRefs = [logsRef, currentRef];
}

function updateCharts(snapshot) {
    const log = Object.values(snapshot.val())
    log.forEach(function(d){ 
        d.timestamp = new Date(d.timestamp * 1000) 
        d.light = ((d.light - lightRange[0]) * 100) / (lightRange[1] - lightRange[0])
        d.water = ((d.water - waterRange[0]) * 100) / (waterRange[1] - waterRange[0])
    });
    updateLines(log)
    updateDonuts(log[log.length - 1]);
}

function getPlants() {
    return new Promise((resolve) => {
        const plantsRef = firebase.database().ref("plants");
        plantsRef.once("value", function(snap) {
            const plants = snap.val();
            const plantList = document.getElementById("plant-list");
            const [firstPlant] = Object.keys(snap.val());
            for(const plantUuid of Object.keys(snap.val())) {
                const plant = plants[plantUuid];
                let config = {
                    uuid: plantUuid,
                    name: plantUuid,
                    waterMin: 0,
                    waterMax: 4095,
                    lightMin: 0,
                    lightMax: 4095
                };

                if(plant.config) {
                    config = plant.config;
                }
                const plantMenuButton = getPlantMenuItem(plantUuid, config);
                plantList.appendChild(plantMenuButton);
            }
            resolve(firstPlant);
        });
    });
}

function setConfigAttributes(element, config) {
    for(const [key, val] of Object.entries(config)) {
        element.setAttribute(key, val);
    }
}

function getPlantMenuItem(uuid, config) {
    console.log(config);
    const plantButton = document.createElement("a");
    plantButton.className = "mdl-navigation__link";
    plantButton.id = `plant-button-${uuid}`;
    plantButton.addEventListener('click', changePlant);
    setConfigAttributes(plantButton, config);

    const plantIcon = document.createElement("i");
    plantIcon.className = "plant-icon mdl-color-text--blue-grey-400 material-icons";
    plantIcon.innerHTML = "local_florist";
    plantIcon.id = `plant-icon-${uuid}`;
    setConfigAttributes(plantIcon, config);

    const nameElement = document.createElement("span");
    nameElement.textContent = config.name;
    nameElement.id = `plant-name-${uuid}`;
    setConfigAttributes(nameElement, config);

    const plantConfigIcon = document.createElement("i");
    plantConfigIcon.className = "plant-settings mdl-color-text--blue-grey-400 material-icons";
    plantConfigIcon.innerHTML = "settings";
    plantConfigIcon.id = `plant-settings-${uuid}`;
    setConfigAttributes(plantConfigIcon, config);
    plantConfigIcon.addEventListener('click', configButton);

    plantButton.appendChild(plantIcon);
    plantButton.appendChild(nameElement);
    plantButton.appendChild(plantConfigIcon);

    return plantButton;
}

/**
 * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
 */
function onAuthStateChanged(user) {
    if (user) {
        startDatabaseQueries();
        document.querySelector("img.user-avatar").src = `${user.photoURL}=s48`;
        document.querySelector("div.user-email").innerHTML = user.email;
        document.getElementById("logged-in").classList.remove("hidden");
        document.getElementById("logged-out").classList.add("hidden");
    } else {
        document.querySelector("img.user-avatar").src = '';
        document.querySelector("div.user-email").innerHTML = '';
        document.getElementById("logged-in").classList.add("hidden");
        document.getElementById("logged-out").classList.remove("hidden");
    }
}

window.addEventListener('load', function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  signInButton.addEventListener('click', () => {
    firebase.auth().signInWithPopup(provider);
  });
  firebase.auth().onAuthStateChanged(onAuthStateChanged);
  const plantConfigSaveBtn = document.getElementById('plant-config-save');
  const plantConfigCancelBtn = document.getElementById('plant-config-cancel');

  plantConfigSaveBtn.addEventListener('click', savePlantConfig);
  plantConfigCancelBtn.addEventListener('click', () => {
      document.getElementById('plant-config-dialog').close();
  });
  document.getElementById('log-out-button').addEventListener('click', () => {
    firebase.auth().signOut();
  });
}, false);

/**
 * Visualisation 
 */
const margin = {top: 20, right: 30, bottom: 30, left: 40};
const width = 900 - margin.left - margin.right, height = 400 - margin.top - margin.bottom;
const lineGraph = initializeLineGraph();
const donutDims = {width: 180, height: 180, radius: 90, hole: 40}
const donutColors = ['#64b5f6', '#eee', '#ff9800']
const arc = d3.arc()
    .innerRadius(donutDims.radius - donutDims.hole)
    .outerRadius(donutDims.radius);
const donutgroup = [];
document.querySelectorAll('.donut').forEach((element) => {
    donutgroup.push(d3.select(element)
        .append('svg')
        .attr('width', donutDims.width)
        .attr('height', donutDims.height)
        .append('g')
        .attr('class', 'donut-container')
        .attr('transform', `translate(${ donutDims.width / 2 },${ donutDims.height / 2 })`));
});

function initializeLineGraph() {
    const lg = {};
    lg.svg = d3
        .select("#graph")
        .append("svg")
        .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);
    lg.graph = lg.svg
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    lg.xScale = d3.scaleTime().range([0, width]);
    lg.xAxis = lg.svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(50,${height + margin.bottom})`);
    lg.water = initialiseLine(lg, 'water', '#0288d1');
    lg.light = initialiseLine(lg, 'light', '#ef6c00');
    lg.temperature = initialiseLine(lg, 'temperature', '#e35454');
    lg.humidity = initialiseLine(lg, 'humidity', '#428af5');
    return lg;
}

function initialiseLine(lg, type, color) {
    const line = {};
    line.yScale = d3.scaleLinear().range([height, 0]);
    line.yAxis = lg.svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
        line.path = lg.graph
        .append('g')
        .append("path")  
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1);
        line.line = d3.line()
        .defined(d => !isNaN(d[type]))
        .x(d => lg.xScale(d.timestamp))
        .y(d => lg[type].yScale(d[type]))
        .curve(d3.curveMonotoneX);
    return line;
}

const updateLines = data => {
    console.log('Updating line data');
    lineGraph.xScale.domain(d3.extent(data, d => d.timestamp))
    lineGraph.light.yScale.domain([0, 100])
    lineGraph.water.yScale.domain([0, 100])
    drawLine('light', data);
    drawLine('water', data);
    drawLine('temperature', 'temperature' in data[0] ? data : []);
    drawLine('humidity', 'humidity' in data[0] ? data: []);
}

function drawLine(line, data) {
    lineGraph[line].yScale.domain([0, 100]);
    lineGraph[line].yAxis
        .call(d3.axisRight(lineGraph[line].yScale))
        .call(g => g.select(".domain").remove())
        .call(g => g.select(".tick:last-of-type text").clone());
    lineGraph[line].path
    .datum(data)
    .attr('d', lineGraph[line].line);
}

function updateDonuts(data) {
    const waterData = [{type: 'water', perc: data.water}, {type: 'rest', perc: 100 - data.water}];
    const lightData = [{type: 'light', perc: data.light}, {type: 'rest', perc: 100 - data.light}];
    const humidityData = [{type: 'humidity', perc: data.humidity}, {type: 'rest', perc: 100 - data.humidity}];
    const temperatureData = [{type: 'temperature', perc: data.temperature}, {type: 'rest', perc: 100 - data.temperature}];
    const pie = d3.pie()
        .padAngle(0.005)
        .sort(null)
        .value(d => d.perc)
    const pieArcsWater = pie(waterData);
    const pieArcsLight = pie(lightData);
    const pieArcsHumidity = pie(humidityData);
    const pieArcsTemperature = pie(temperatureData);

    drawDonut(0, pieArcsWater, waterData, '#64b5f6', '%');
    drawDonut(1, pieArcsLight, lightData, '#ff9800', '%');
    if('humidity' in data) {
        drawDonut(2, pieArcsHumidity, humidityData, '#428af5', '%');
    } else {
        drawDonut(2, pie([{type:'', perc:''}]), [{type:'', perc:''}], '#fff', '');
    }
    if('temperature' in data) {
        drawDonut(3, pieArcsTemperature, temperatureData, '#e35454', '˚');
    } else {
        drawDonut(3, pie([{type:'', perc:''}]), [{type:'', perc:''}], '#fff', '');
    }
    
}

function drawDonut(index, pieArc, data, color, suffix) {
    const colorScale = d3.scaleOrdinal(data.map(d => d.type), [color, '#eee']);
    donutgroup[index].selectAll('path')
        .data(pieArc)
        .join('path')
            .style('stroke', 'white')
            .style('stroke-width', 2)
            .style('fill', d => colorScale( d.data.type ))
            .attr('d', arc)

  	donutgroup[index].selectAll("text")
  	  .data([data])
  	  .join("text")
  	  .attr("text-anchor", "middle")
  	  .attr("dy", ".3em")
  	  .style("font", "8px sans-serif")
  	  .style("max-width", "100%")
  	  .style("height", "auto")
  	  .attr("text-anchor", "middle")
  	  .attr("fill", '#616161')
  	  .text((d) => {
            if(d[0].perc) {
                return Math.floor(d[0].perc) + suffix;
            } else {
                return '';
            }
      })
  	  .attr("transform", `scale(${ (donutDims.radius - donutDims.hole)/15 })`);
}
