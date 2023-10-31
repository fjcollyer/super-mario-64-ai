window.addEventListener('DOMContentLoaded', function () {
  console.log('Calling train()');
  train();

  // setUpHTML();
  // this.setInterval(updateHTML, 100); // Every 100ms
});

async function train() {
  console.log('train()');
  const env = new MarioEnvironment();
  const agent = new PPOAgent();

  // Testing TensorFlow.js
  const model = tf.sequential();
  model.add(tf.layers.dense({units: 128, activation: 'relu', inputShape: [784]}));
  console.log('model.layers.length: ' + model.layers.length);
  console.log(model)


  for (let episode = 0; episode < 1000; episode++) {
      let state = env.reset();
      let reward;
      let done = false;
      let episodeReward = 0;

      while (!done) {
          let action = agent.predict(state);
          ({state, reward, done} = env.step(action));
          episodeReward += reward;
          await new Promise(resolve => setTimeout(resolve, 1000)); 
          console.log('looping');
      }

      // After each episode, update the agent's policy
      agent.update(/* collected experiences */);

      console.log(`Episode ${episode}: Reward = ${episodeReward}`);
  }
}


class MarioEnvironment {
  constructor() {
      console.log('MarioEnvironment constructor()');
      this.actionSpace = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
      this.startingPosition = {x: -1328, y: 260, z: 4664};
  }

  reset() {
      console.log('reset()')
      const memMapInstance = n64js.hardware().memMap;
      // Convert the float values to raw memory values
      const marioXRawValue = bitsFromFloat(this.startingPosition.x);
      const marioYRawValue = bitsFromFloat(this.startingPosition.y);
      const marioZRawValue = bitsFromFloat(this.startingPosition.z);
      // Write the raw memory values to set Mario's position
      memMapInstance.writeMemoryInternal32(0x8033B1AC, marioXRawValue);
      memMapInstance.writeMemoryInternal32(0x8033B1B0, marioYRawValue);
      memMapInstance.writeMemoryInternal32(0x8033B1B4, marioZRawValue);
      return this.getState();
  }

  step(action) {
      console.log('step()');
      // Simulate the action
      this.simulateKeyPress(action, 250);

      const newState = this.getState();
      let reward = 0;
      let done = false;

      // Check if Mario has fallen
      if (Math.abs(newState.marioY - 260) > 5) {
          reward = -1;
          done = true;
      }

      return {state: newState, reward, done};
  }

  simulateKeyPress(key, ms) {
    console.log('simulateKeyPress()');
    // Press the key
    const event = new KeyboardEvent('keydown', { key: key });
    document.body.dispatchEvent(event);
    // Release the key
    setTimeout(() => {
      const event = new KeyboardEvent('keyup', { key: key });
      document.body.dispatchEvent(event);
    }, ms);
  }

  getState() {
    console.log('getState()');
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
    const marioNumberOfLivesRawValue = memMapInstance.readMemoryInternal32(0x8033B21A);
    const marioNumberOfLivesValue = marioNumberOfLivesRawValue & 0xFFFF;
  
    // Extract Mario's Speed
    const marioSpeedRawValue = memMapInstance.readMemoryInternal32(0x8033B1C4);
    const marioSpeedValue = floatFromBits(marioSpeedRawValue);
  
    // Extract image data
    const canvas = document.getElementById('display');
    console.log(canvas);
    const img = canvas.toDataURL();
    console.log(img);
  
    // const gl = canvas.getContext('webgl2');
    // const pixels = new Uint8Array(canvas.width * canvas.height * 4); // *4 for RGBA values
    // gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    const state = {
      marioX: marioXValue,
      marioY: marioYValue,
      marioZ: marioZValue,
      marioHealth: marioHealthRawValue,
      marioNumberOfLives: marioNumberOfLivesValue,
      marioSpeed: marioSpeedValue,
      img: img,
    };
    return state;
  }
}
class PPOAgent {
  constructor() {
      console.log('PPOAgent constructor()');
      this.actionSpace = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  }

  predict(state) {
      console.log('predict()');
      const randomIndex = Math.floor(Math.random() * this.actionSpace.length);
      return this.actionSpace[randomIndex];
  }

  update(experiences) {
  }
}

//
// Helper functions
//
function bitsFromFloat(floatValue) {
  const buffer = new ArrayBuffer(4);
  new Float32Array(buffer)[0] = floatValue;
  return new Uint32Array(buffer)[0];
}

function floatFromBits(bits) {
  const buffer = new ArrayBuffer(4);
  new Uint32Array(buffer)[0] = bits;
  return new Float32Array(buffer)[0];
}

function toHex(value, length) {
  return value.toString(16).padStart(length, '0').toUpperCase();
}

//
// Purley UI functions below
//

function setUpHTML() {
  const htmlContent = `
      <div id="fjc" style="padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
          <!-- Inputs to set Mario's position -->
          <div style="margin-top: 20px;">
              <label>Mario X Position: <input type="text" id="set-mario-x"></label>
              <label>Mario Y Position: <input type="text" id="set-mario-y"></label>
              <label>Mario Z Position: <input type="text" id="set-mario-z"></label>
              <button type="button" id="set-position-button" onclick="handleSetMarioPositionButtonClick()">Set Position</button>
          </div>
          <div id="mario-values" style="margin-top: 20px;"></div>
      </div>
  `;
  document.body.insertAdjacentHTML('afterbegin', htmlContent);
}

function handleSetMarioPositionButtonClick() {
  const xValue = document.getElementById('set-mario-x').value;
  const yValue = document.getElementById('set-mario-y').value;
  const zValue = document.getElementById('set-mario-z').value;

  if (!xValue || !yValue || !zValue) {
    alert('Please fill in all the fields before setting Mario\'s position.');
    return;
  }

  setMarioPosition(parseFloat(xValue), parseFloat(yValue), parseFloat(zValue));
}

function updateHTML() {
  const state = getState();
  const container = document.getElementById('mario-values');
  container.innerHTML = '';
  appendRow(container, 'mario-x', `Mario X Position: ${state.marioX}`);
  appendRow(container, 'mario-y', `Mario Y Position: ${state.marioY}`);
  appendRow(container, 'mario-z', `Mario Z Position: ${state.marioZ}`);
  appendRow(container, 'mario-health', `Mario Health: ${state.marioHealth}`);
  appendRow(container, 'mario-lives', `Mario Lives: ${state.marioNumberOfLives}`);
}

function appendRow(container, id, label) {
  const div = document.createElement('div');
  div.id = id;
  div.textContent = label;
  container.appendChild(div);
  container.appendChild(document.createElement('br'));
}