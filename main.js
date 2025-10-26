/*
 * ===================================
 * main.js
 * * This is the main application logic.
 * * It finds expected new moons, populates the UI,
 * * and calculates feast days based on user confirmation.
 * ===================================
 */

// Import Three.js
import * as THREE from 'three';

// Import our feast list from the other file
import { FEASTS } from './feasts.js';

// --- Global State ---
let waveSheafDateGlobal = null;
let savedCalendar = {}; // To hold our loaded data

// --- 3D Scene Globals ---
let scene, camera, renderer, moonMesh, sunLight;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// --- Constants ---
const JERUSALEM_LAT = 31.7683;
const JERUSALEM_LON = 35.2137;
const LUNAR_CYCLE_DAYS = 29.530588861; // Average synodic period

/**
 * Main function to run when the page loads.
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. (NEW) Load any saved calendar data
  loadSavedCalendar(); 

  // 2. Get the current year
  const thisYear = new Date().getFullYear();
  
  // 3. Find all expected new moons
  const expectedMoons = findExpectedNewMoons(thisYear);
  
  // 4. Use that data to build our HTML interface
  populateCalendarControls(expectedMoons);
  
  // 5. Activate the "Calculate Feasts" buttons
  addCalendarEventListeners();
  
  // 6. START THE LIVE VISUALS
  startLiveVisuals();
  
  // 7. (NEW) Re-display any saved data
  redisplaySavedFeasts();
});

/**
 * Uses SunCalc to find all astronomical new moons for a given year.
 */
function findExpectedNewMoons(year) {
  console.log(`Calculating expected new moons for ${year}...`);
  const newMoons = [];
  
  // 1. Find the *first* new moon of the year (by finding the minimum phase)
  let searchDate = new Date(year, 0, 1, 0, 0, 0); // Jan 1, midnight
  let minPhase = 1.0;
  let firstNewMoonDate = searchDate;

  // Search the first ~35 days of the year
  for (let d = 0; d < 35 * 24; d++) { // Check every hour
    const illum = SunCalc.getMoonIllumination(searchDate);
    if (illum.phase < minPhase) {
      minPhase = illum.phase;
      firstNewMoonDate = new Date(searchDate);
    }
    searchDate.setHours(searchDate.getHours() + 1);
  }
  newMoons.push(firstNewMoonDate);

  // 2. Use the first new moon to find the rest
  let lastNewMoon = firstNewMoonDate;
  for (let m = 0; m < 12; m++) {
    const nextNewMoonTime = lastNewMoon.getTime() + (LUNAR_CYCLE_DAYS * 24 * 60 * 60 * 1000);
    let nextNewMoonDate = new Date(nextNewMoonTime);
    
    let minPhase2 = 1.0;
    let accurateNextDate = new Date(nextNewMoonDate);
    accurateNextDate.setHours(accurateNextDate.getHours() - 12); // Search 24-hr window
    
    for (let h = 0; h < 24; h++) {
        accurateNextDate.setHours(accurateNextDate.getHours() + 1);
        const illum = SunCalc.getMoonIllumination(accurateNextDate);
        if (illum.phase < minPhase2) {
            minPhase2 = illum.phase;
            nextNewMoonDate = new Date(accurateNextDate);
        }
    }
    
    if (nextNewMoonDate.getFullYear() === year) {
      newMoons.push(nextNewMoonDate);
    }
    lastNewMoon = nextNewMoonDate;
  }
  
  console.log("Found expected new moons:", newMoons);
  return newMoons;
}

/**
 * Creates the HTML controls for each predicted new moon.
 */
function populateCalendarControls(newMoons) {
  const container = document.getElementById('calendar-controls');
  container.innerHTML = ''; // Clear any existing content

  const instructions = document.createElement('p');
  instructions.innerHTML = `<strong>Instructions:</strong> Find a predicted new moon. 
    Based on the *visual sighting*, enter the date for <strong>Day 1</strong> (the day *after* the sighting). 
    Then, enter the <strong>Biblical Month #</strong> (e.g., 1 for Aviv) and click 'Calculate'.`;
  container.prepend(instructions);

  newMoons.forEach((date, index) => {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'month-entry';

    monthDiv.innerHTML = `
      <h3>Potential Month (Prediction ${index + 1})</h3>
      <p class="expected-date">Astronomical New Moon: ${date.toLocaleString()}</p>
      
      <label for="month-${index}-date"><b>1. Confirmed Day 1:</b></label>
      <input type="date" id="month-${index}-date">
      
      <label for="month-${index}-num"><b>2. Biblical Month #:</b></label>
      <input type="number" id="month-${index}-num" min="1" max="13" style="width: 80px;">
      
      <button id="month-${index}-btn" data-index="${index}">
        Calculate Feasts
      </button>
    `;
    
    // Pre-fill "Day 1" with the day *after* the astronomical new moon as a suggestion
    const dayAfter = new Date(date);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const dateInput = monthDiv.querySelector(`#month-${index}-date`);
    const numInput = monthDiv.querySelector(`#month-${index}-num`);
    dateInput.value = dayAfter.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // (NEW) Check if we have saved data for this input slot
    if (savedCalendar[index + 1]) {
      const savedDate = new Date(savedCalendar[index + 1]);
      dateInput.value = savedDate.toISOString().split('T')[0];
      numInput.value = index + 1;
    }

    container.appendChild(monthDiv);
  });
}

/**
 * Adds a single, smart event listener to the main container
 * that handles all button clicks.
 */
function addCalendarEventListeners() {
  const container = document.getElementById('calendar-controls');
  
  container.addEventListener('click', (event) => {
    // Only act if a "Calculate Feasts" button was clicked
    if (event.target.tagName !== 'BUTTON') {
      return;
    }

    const index = event.target.dataset.index;
    const dateInput = document.getElementById(`month-${index}-date`);
    const numInput = document.getElementById(`month-${index}-num`);

    const confirmedDateStr = dateInput.value;
    const monthNumber = parseInt(numInput.value, 10);

    // --- Validation ---
    if (!confirmedDateStr) {
      alert('Please select a confirmed Day 1 date.');
      return;
    }
    if (isNaN(monthNumber) || monthNumber < 1 || monthNumber > 13) {
      alert('Please enter a valid month number (1-13).');
      return;
    }

    // This creates a date object at midnight *local time*
    const dayOne = new Date(confirmedDateStr + 'T00:00:00');

    // --- (NEW) Save this entry ---
    saveCalendarEntry(monthNumber, dayOne.toISOString());

    // --- Special Shavuot Logic ---
    if (monthNumber === 3 && !waveSheafDateGlobal) {
      alert('Cannot calculate Shavuot (Month 3)!\n\nYou must first calculate Month 1 (Aviv) so the date of the Wave Sheaf Offering can be set.');
      return;
    }

    // --- Calculation ---
    const feastDates = calculateFeasts(dayOne, monthNumber, waveSheafDateGlobal);
    
    // --- Store Wave Sheaf Date (if we just calculated it) ---
    if (monthNumber === 1) {
      const waveSheaf = feastDates.find(f => f.name.includes("Wave Sheaf"));
      if (waveSheaf) {
        waveSheafDateGlobal = waveSheaf.date;
        console.log("Global Wave Sheaf Date SET:", waveSheafDateGlobal);
        // (NEW) Re-save calendar to include the wave sheaf date
        saveCalendarEntry(monthNumber, dayOne.toISOString());
      }
    }
    
    // --- Display ---
    displayFeasts(feastDates, monthNumber);
  });
}

/**
 * Helper function to add days to a date.
 */
function addDays(date, days) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/**
 * The core logic. Calculates all feast dates for a given month.
 */
function calculateFeasts(dayOne, monthNumber, waveSheafDate = null) {
  const calculatedFeasts = [];

  // 1. Find all feasts that are for this specific month number
  const feastsThisMonth = FEASTS.filter(feast => feast.month === monthNumber);

  feastsThisMonth.forEach(feast => {
    // Handle simple "Day X" feasts
    if (typeof feast.day === 'number') {
      const feastDate = addDays(dayOne, feast.day - 1);
      calculatedFeasts.push({ ...feast, date: feastDate });
    }
  });

  // 2. Handle special case: Wave Sheaf (Month 1)
  if (monthNumber === 1) {
    const ubDay15 = addDays(dayOne, 14); // Start of Unleavened Bread
    let foundWaveSheafDate = null;
    
    for (let i = 0; i < 7; i++) {
      let testDate = addDays(ubDay15, i);
      if (testDate.getDay() === 0) { // 0 = Sunday
        foundWaveSheafDate = testDate;
        break;
      }
    }

    if (foundWaveSheafDate) {
      FEASTS.filter(f => f.day === 'morrow_after_weekly_sabbath' && f.month === 1)
            .forEach(f => {
              calculatedFeasts.push({ ...f, date: foundWaveSheafDate });
            });
    }
  }
  
  // 3. Handle special case: Shavuot (Month 3)
  if (monthNumber === 3 && waveSheafDate) {
    const shavuotDate = addDays(waveSheafDate, 49);
    
    const shavuotFeast = FEASTS.find(f => f.day === '50_days_from_wave_sheaf');
    if (shavuotFeast) {
      calculatedFeasts.push({ ...shavuotFeast, date: shavuotDate });
    }
  }
  
  return calculatedFeasts.sort((a, b) => a.date - b.date); // Sort by date
}

/**
 * Renders the calculated feast list to the page.
 */
function displayFeasts(feastDates, monthNumber) {
  const feastListDiv = document.getElementById('feast-day-list');
  
  const monthFeastContainer = document.createElement('div');
  monthFeastContainer.id = `month-${monthNumber}-feasts`;
  
  const title = document.createElement('h3');
  title.innerText = `Calculated Feasts for Month ${monthNumber}`;
  monthFeastContainer.appendChild(title);
  
  const outputList = document.createElement('ul');
  
  if (feastDates.length === 0) {
    outputList.innerHTML = '<li>No fixed feasts found for this month.</li>';
  } else {
    feastDates.forEach(feast => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${feast.name}</strong>: ${feast.date.toLocaleDateString()}
        <em>(${feast.description})</em>
      `;
      outputList.appendChild(li);
    });
  }
  monthFeastContainer.appendChild(outputList);
  
  const existingDisplay = document.getElementById(monthFeastContainer.id);
  if (existingDisplay) {
    feastListDiv.replaceChild(monthFeastContainer, existingDisplay);
  } else {
    feastListDiv.appendChild(monthFeastContainer);
  }
}

// =============================================
// PHASE 2 - LIVE VISUALS
// =============================================

/**
 * Converts the sun's ecliptic longitude into a Zodiac sign.
 */
function getZodiacSign(longitude) {
  const ZODIAC = [
    { sign: 'Aries', start: 21 },
    { sign: 'Taurus', start: 51 },
    { sign: 'Gemini', start: 81 },
    { sign: 'Cancer', start: 111 },
    { sign: 'Leo', start: 141 },
    { sign: 'Virgo', start: 174 },
    { sign: 'Libra', start: 204 },
    { sign: 'Scorpio', start: 234 },
    { sign: 'Sagittarius', start: 266 },
    { sign: 'Capricorn', start: 296 },
    { sign: 'Aquarius', start: 326 },
    { sign: 'Pisces', start: 355 }
  ];
  
  const longitudeDeg = longitude * 180 / Math.PI;

  let sunSign = 'Pisces'; // Default (handles wraparound)
  for (const sign of ZODIAC) {
    if (longitudeDeg >= sign.start) {
      sunSign = sign.sign;
    } else {
      break; 
    }
  }
  return sunSign;
}

/**
 * Main loop to update visuals in real-time.
 */
function startLiveVisuals() {
  try {
    init3DScene();
  } catch (error) {
    console.error("Could not initialize 3D scene:", error);
    document.getElementById('moon-phase-container').innerHTML = "Could not load 3D moon.";
  }

  animate();

  const moonPhaseText = document.getElementById('moon-phase-text');
  const sunZodiacText = document.getElementById('sun-zodiac-text');

  function update() {
    const now = new Date();
    
    const moonIllum = SunCalc.getMoonIllumination(now);
    const phasePercent = (moonIllum.fraction * 100).toFixed(1);
    
    let phaseName = '';
    const phase = moonIllum.phase;
    if (phase < 0.03 || phase > 0.97) phaseName = 'New Moon';
    else if (phase < 0.22) phaseName = 'Waxing Crescent';
    else if (phase < 0.28) phaseName = 'First Quarter';
    else if (phase < 0.47) phaseName = 'Waxing Gibbous';
    else if (phase < 0.53) phaseName = 'Full Moon';
    else if (phase < 0.72) phaseName = 'Waning Gibbous';
    else if (phase < 0.78) phaseName = 'Third Quarter';
    else phaseName = 'Waning Crescent';

    const sunInfo = SunCalc.getSunInfo(now, JERUSALEM_LAT, JERUSALEM_LON);
    const sunSign = getZodiacSign(sunInfo.eclipticLongitude);

    moonPhaseText.textContent = `Current Phase: ${phaseName} (${phasePercent}%)`;
    sunZodiacText.textContent = `Sun's Position: ${sunSign}`;
    
    update3DScene(moonIllum.angle);

    setTimeout(update, 1000);
  }
  
  update();
}

// =============================================
// PHASE 3 - 3D ENGINE
// =============================================

function init3DScene() {
  const canvas = document.getElementById('moon-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();

  const fov = 45;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const near = 0.1;
  const far = 1000; // Increased for starfield
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.position.set(1, 0, 1);
  scene.add(sunLight);

  const textureLoader = new THREE.TextureLoader();
  const colorTexture = textureLoader.load(
    'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_projp.png'
  );
  const displacementTexture = textureLoader.load(
    'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_64_uint.png'
  );

  const geometry = new THREE.SphereGeometry(0.8, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    map: colorTexture,
    displacementMap: displacementTexture,
    displacementScale: 0.02,
    metalness: 0,
    roughness: 1,
  });
  moonMesh = new THREE.Mesh(geometry, material);
  scene.add(moonMesh);

  addMouseControls(canvas);

  // Load the starfield
  createStarfield();

  // Load the constellation lines
  createConstellations();
}

function animate() {
  requestAnimationFrame(animate);

  if (moonMesh && !isDragging) {
    moonMesh.rotation.y += 0.001;
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function update3DScene(moonAngle) {
  if (!sunLight) return;
  sunLight.position.x = Math.cos(moonAngle);
  sunLight.position.z = Math.sin(moonAngle);
}

function addMouseControls(canvas) {
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    canvas.style.cursor = 'grabbing';
    previousMousePosition.x = e.clientX;
    previousMousePosition.y = e.clientY;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !moonMesh) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    moonMesh.rotation.y += deltaX * 0.01;
    moonMesh.rotation.x += deltaY * 0.01;
    previousMousePosition.x = e.clientX;
    previousMousePosition.y = e.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });
  
  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });
}

// =============================================
// PHASE 4 - STARFIELD
// =============================================

function createStarfield() {
  const loader = new THREE.FileLoader();
  
  loader.load(
    'stars.json',
    (data) => {
      const starData = JSON.parse(data);
      console.log(`Loaded ${starData.length} stars.`);
      const positions = new Float32Array(starData.length * 3);
      const starGeometry = new THREE.BufferGeometry();

      for (let i = 0; i < starData.length; i++) {
        const star = starData[i];
        const distance = 500;
        const ra = star.ra * Math.PI / 180;
        const dec = star.dec * Math.PI / 180;
        const x = distance * Math.cos(dec) * Math.cos(ra);
        const y = distance * Math.sin(dec);
        const z = distance * Math.cos(dec) * Math.sin(ra);
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }

      starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        sizeAttenuation: false,
      });
      const starfield = new THREE.Points(starGeometry, starMaterial);
      starfield.renderOrder = -1;
      scene.add(starfield);
      console.log("Starfield added to scene.");
    },
    (xhr) => { console.log(`Loading stars: ${(xhr.loaded / xhr.total * 100)}%`); },
    (err) => { console.error('An error happened while loading the star data:', err); }
  );
}

// =============================================
// PHASE 6 - CONSTELLATION LINES
// =============================================

function createConstellations() {
  const loader = new THREE.FileLoader();
  
  loader.load(
    'constellations.lines.json',
    (data) => {
      const constellationData = JSON.parse(data);
      console.log(`Loaded ${constellationData.features.length} constellations.`);
      const points = [];
      const distance = 500;

      constellationData.features.forEach(constellation => {
        const segments = constellation.geometry.coordinates;
        segments.forEach(segment => {
          for (let i = 0; i < segment.length - 1; i++) {
            const startCoords = segment[i];
            const endCoords = segment[i + 1];

            const raStart = startCoords[0] * Math.PI / 180;
            const decStart = startCoords[1] * Math.PI / 180;
            const xStart = distance * Math.cos(decStart) * Math.cos(raStart);
            const yStart = distance * Math.sin(decStart);
            const zStart = distance * Math.cos(decStart) * Math.sin(raStart);
            points.push(new THREE.Vector3(xStart, yStart, zStart));

            const raEnd = endCoords[0] * Math.PI / 180;
            const decEnd = endCoords[1] * Math.PI / 180;
            const xEnd = distance * Math.cos(decEnd) * Math.cos(raEnd);
            const yEnd = distance * Math.sin(decEnd);
            const zEnd = distance * Math.cos(decEnd) * Math.sin(raEnd);
            points.push(new THREE.Vector3(xEnd, yEnd, zEnd));
          }
        });
      });

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.2,
        transparent: true
      });
      const constellationLines = new THREE.LineSegments(lineGeometry, lineMaterial);
      constellationLines.renderOrder = -1;
      scene.add(constellationLines);
      console.log("Constellation lines added to scene.");
    },
    (err) => { console.error('An error happened while loading the constellation data:', err); }
  );
}

// =============================================
// PHASE 5 - LOCAL STORAGE
// =============================================

function loadSavedCalendar() {
  const savedData = localStorage.getItem('karaiteCalendar');
  if (savedData) {
    savedCalendar = JSON.parse(savedData);
    console.log("Loaded saved calendar:", savedCalendar);
    
    if (savedCalendar.waveSheafDate) {
      waveSheafDateGlobal = new Date(savedCalendar.waveSheafDate);
      console.log("Restored Wave Sheaf Date:", waveSheafDateGlobal);
    }
  } else {
    savedCalendar = {};
  }
}

function saveCalendarEntry(monthNumber, dateString) {
  savedCalendar[monthNumber] = dateString;
  
  if (monthNumber === 1 && waveSheafDateGlobal) {
    savedCalendar.waveSheafDate = waveSheafDateGlobal.toISOString();
  }

  localStorage.setItem('karaiteCalendar', JSON.stringify(savedCalendar));
  console.log("Saved calendar to localStorage:", savedCalendar);
}

function redisplaySavedFeasts() {
  console.log("Redisplaying saved feasts...");
  
  const savedMonthNumbers = Object.keys(savedCalendar).filter(key => key !== 'waveSheafDate');
  savedMonthNumbers.sort((a, b) => a - b);
  
  for (const monthNumStr of savedMonthNumbers) {
    const monthNumber = parseInt(monthNumStr, 10);
    const dayOne = new Date(savedCalendar[monthNumStr]);
    
    console.log(`Recalculating for saved Month ${monthNumber}`);
    const feastDates = calculateFeasts(dayOne, monthNumber, waveSheafDateGlobal);
    displayFeasts(feastDates, monthNumber);
  }
}