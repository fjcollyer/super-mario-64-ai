// Function to inject the HTML content
function injectHTML() {
  const htmlContent = `
      <div class="container-fluid">
          <div class="row">
              <div class="col col-sm-12">
                  <h1 id="title">n64js</h1>
                  <p>An n64 emulator. <a href="#" onclick="$('#info').toggle()">Info</a></p>
              </div>
          </div>

          <!-- FJC -->
          <div id="fjc" style="padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
              <button type="button" class="btn" onclick="" id="loadButtonSelenium">
                  Load (Selenium)
              </button>
              <input type="text" id="selenium-inputs" style="margin-left: 10px; margin-right: 10px;" />
              <button type="button" class="btn" onclick="displayMarioValues()">
                  Show Mario's Values
              </button>
              <div id="mario-values" style="margin-top: 20px;"></div>
          </div>
  `;

  // Inject the HTML content as the first item after the body opening tag
  document.body.insertAdjacentHTML('afterbegin', htmlContent);
}

// Call the injectHTML function when the page loads
window.addEventListener('DOMContentLoaded', injectHTML);

function displayMarioValues() {
  const memMapInstance = n64js.hardware().memMap;
  
  // Extract Mario's X, Y, Z positions
  const marioXRawValue = memMapInstance.readMemoryInternal32(0x8033B1AC);
  const marioXValue = floatFromBits(marioXRawValue);
  
  const marioYRawValue = memMapInstance.readMemoryInternal32(0x8033B1B0);
  const marioYValue = floatFromBits(marioYRawValue);
  
  const marioZRawValue = memMapInstance.readMemoryInternal32(0x8033B1B4);
  const marioZValue = floatFromBits(marioZRawValue);
  
  // Extract Mario's Health (Power Meter)
  const marioHealthRawValue32 = memMapInstance.readMemoryInternal32(0x8033B21C);
  const marioHealthRawValue = (marioHealthRawValue32 >> 8) & 0xFF; // Extract the byte at offset 0x1D

  // Extract Number of Lives
  const numberOfLivesRawValue = memMapInstance.readMemoryInternal32(0x8033B21A);
  const numberOfLivesValue = numberOfLivesRawValue & 0xFFFF;

  // Extract Mario's Speed
  const marioSpeedRawValue = memMapInstance.readMemoryInternal32(0x8033B1C4);
  const marioSpeedValue = floatFromBits(marioSpeedRawValue);
  
  // Append to the DOM
  const container = document.getElementById('mario-values');
  container.innerHTML = '';
  
  appendRow(container, 'mario-x-position', `Mario X Position: ${marioXValue} (Raw: ${toHex(marioXRawValue, 8)})`);
  appendRow(container, 'mario-y-position', `Mario Y Position: ${marioYValue} (Raw: ${toHex(marioYRawValue, 8)})`);
  appendRow(container, 'mario-z-position', `Mario Z Position: ${marioZValue} (Raw: ${toHex(marioZRawValue, 8)})`);
  appendRow(container, 'mario-health', `Mario's Health: ${marioHealthRawValue}/8 segments (Raw: ${toHex(marioHealthRawValue, 2)})`);
  appendRow(container, 'mario-lives', `Number of Lives: ${numberOfLivesValue} (Raw: ${toHex(numberOfLivesRawValue, 8)})`);
  appendRow(container, 'mario-speed', `Mario's Speed: ${marioSpeedValue} (Raw: ${toHex(marioSpeedRawValue, 8)})`);
}

function floatFromBits(bits) {
  const buffer = new ArrayBuffer(4);
  new Uint32Array(buffer)[0] = bits;
  return new Float32Array(buffer)[0];
}

function toHex(value, length) {
  return value.toString(16).padStart(length, '0').toUpperCase();
}

function appendRow(container, id, label) {
  const div = document.createElement('div');
  div.id = id;
  div.textContent = label;
  container.appendChild(div);
  container.appendChild(document.createElement('br'));
}