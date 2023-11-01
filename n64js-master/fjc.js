window.addEventListener('DOMContentLoaded', function () {
  // Create and append a button that calls train() when clicked
  const button = document.createElement('button');
  button.textContent = 'Train';
  document.body.appendChild(button);
  button.addEventListener('click', () => {
    console.log('Calling train()');
    train();
  });
});

async function train() {
  console.log('train()');

  if (!window.fjcPixels || !window.fjcFrameBufferWidth || !window.fjcFrameBufferHeight) {
    alert('Cant train. One of the following variables is missing: window.fjcPixels, window.fjcFrameBufferWidth, window.fjcFrameBufferHeight. Often caused by not having a ROM loaded.');
    return;
  }

  const env = new MarioEnvironment();
  const agent = new PPOAgent();
  const myHtml = new MarioHtml(env, agent);

  let episodeRewards = [];
  const numEpisodes = 100;
  for (let episode = 0; episode < numEpisodes; episode++) {    
      let state = env.reset();
      let newState;
      let reward;
      let done = false;
      let episodeReward = 0;

      // Remember to pass the image data to the agent not the state object
      while (!done) {
          let action = agent.predict(state.img);
          ({newState, reward, done} = env.step(action));
          agent.storeExperience(state.img, action, reward, newState.img, done);
          state = newState;
          episodeReward += reward;
          myHtml.updateHTML();
          await new Promise(resolve => setTimeout(resolve, 1000)); 
      }

      // After each episode, update the agent's policy
      agent.update();
      episodeRewards.push(episodeReward);
      myHtml.updateRewardGraph(episodeRewards);
      console.log(`Episode ${episode}: Reward = ${episodeReward}`);
  }
}

class PPOAgent {
  constructor() {
    console.log('PPOAgent constructor()');
    this.actionSpace = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    this.stateSpace = [128, 128, 1];
    this.memory = {
      states: [],
      actions: [],
      rewards: [],
      newStates: [],
      dones: [],
    };
    this.policyNetwork = this.createPolicyNetwork();
    this.valueNetwork = this.createValueNetwork();
    this.gamma = 0.99;
    this.epsilon = 0.2;
    this.learningRate = 0.001;
    this.epochs = 10;
  }

  createPolicyNetwork() {
    console.log('createPolicyNetwork()');
    const model = tf.sequential();
    model.add(tf.layers.conv2d({
      filters: 32,
      kernelSize: 8,
      strides: 4,
      activation: 'relu',
      inputShape: this.stateSpace
    }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({units: 128, activation: 'relu'}));
    model.add(tf.layers.dense({units: this.actionSpace.length, activation: 'softmax'}));
    model.compile({optimizer: tf.train.adam(this.learningRate), loss: 'categoricalCrossentropy'});
    return model;
  }

  createValueNetwork() {
    console.log('createValueNetwork()');
    const model = tf.sequential();
    model.add(tf.layers.conv2d({
      filters: 32,
      kernelSize: 8,
      strides: 4,
      activation: 'relu',
      inputShape: this.stateSpace
    }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({units: 128, activation: 'relu'}));
    model.add(tf.layers.dense({units: 1}));
    model.compile({optimizer: tf.train.adam(this.learningRate), loss: 'meanSquaredError'});
    return model;
  }

  predict(state) {
    console.log('predict()');
    // Ensure state is a TensorFlow tensor
    if (!(state instanceof tf.Tensor)) {
        console.error('Invalid state:', state);
        return;
    }
    const tfState = state.expandDims(0);  // Add a batch dimension
    const probs = this.policyNetwork.predict(tfState).arraySync();
    const action = tf.multinomial(probs[0], 1).dataSync()[0];
    return this.actionSpace[action];
  }

  storeExperience(state, action, reward, newState, done) {
    console.log('storeExperience()');
    this.memory.states.push(state);
    this.memory.actions.push(action);
    this.memory.rewards.push(reward);
    this.memory.newStates.push(newState);
    this.memory.dones.push(done);
  }

  async update() {
    console.log('update()');
    const discountedRewards = this.computeDiscountedRewards();
    for (let epoch = 0; epoch < this.epochs; epoch++) {
      const tfStates = tf.tensor4d(this.memory.states.map(s => s.dataSync()), [this.memory.states.length, ...this.stateSpace]);
      const tfActions = tf.tensor1d(this.memory.actions.map(a => this.actionSpace.indexOf(a)), 'int32');
      const tfDiscountedRewards = tf.tensor1d(discountedRewards);

      const withGradients = tf.grads((states, actions, rewards) => {
        const logits = this.policyNetwork.apply(states);
        const advantages = rewards.sub(this.valueNetwork.apply(states).squeeze()).dataSync();

        const actionMasks = tf.oneHot(actions, this.actionSpace.length);
        const oldProbs = tf.sum(actionMasks.mul(logits), 1);

        const lossValue = tf.mean(tf.square(advantages));
        const newProbs = tf.sum(actionMasks.mul(logits), 1);
        const ratio = newProbs.div(oldProbs);
        const clippedRatio = tf.clipByValue(ratio, 1 - this.epsilon, 1 + this.epsilon);
        const lossPolicy = -tf.mean(tf.minimum(ratio.mul(advantages), clippedRatio.mul(advantages)));
        return lossPolicy.add(lossValue);
      });

      const [dLoss_dStates, dLoss_dActions, dLoss_dRewards] = withGradients([tfStates, tfActions, tfDiscountedRewards]);
      const grads = { dLoss_dStates, dLoss_dActions, dLoss_dRewards };

      const optimizer = tf.train.adam(this.learningRate);
      optimizer.applyGradients(grads);
    }

    // Clear memory
    this.memory = { states: [], actions: [], rewards: [], newStates: [], dones: [] };
  }

  computeDiscountedRewards() {
    console.log('computeDiscountedRewards()');
    const { rewards, dones } = this.memory;
    const discountedRewards = new Array(rewards.length).fill(0);
    let cumulativeReward = 0;

    for (let i = rewards.length - 1; i >= 0; i--) {
      cumulativeReward = rewards[i] + this.gamma * cumulativeReward * (1 - dones[i]);
      discountedRewards[i] = cumulativeReward;
    }

    return discountedRewards;
  }
}

class MarioEnvironment {
  constructor() {
      console.log('MarioEnvironment constructor()');
      this.actionSpace = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
      this.startingPosition = {x: -1328, y: 260, z: 4664};
  }

  setMarioPosition(x, y, z) {
    const memMapInstance = n64js.hardware().memMap;
    // Convert the float values to raw memory values
    const marioXRawValue = bitsFromFloat(x);
    const marioYRawValue = bitsFromFloat(y);
    const marioZRawValue = bitsFromFloat(z);
    // Write the raw memory values to set Mario's position
    memMapInstance.writeMemoryInternal32(0x8033B1AC, marioXRawValue);
    memMapInstance.writeMemoryInternal32(0x8033B1B0, marioYRawValue);
    memMapInstance.writeMemoryInternal32(0x8033B1B4, marioZRawValue);
  }

  reset() {
      console.log('reset()')
      this.setMarioPosition(this.startingPosition.x, this.startingPosition.y, this.startingPosition.z);
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

      return {newState, reward, done};
  }

  simulateKeyPress(key, ms) {
    console.log('simulateKeyPress()');
    console.log(`Simulating key press: ${key}`);
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
    // console.log('getState()');
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
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = window.fjcFrameBufferWidth;
    originalCanvas.height = window.fjcFrameBufferHeight;
    const originalCtx = originalCanvas.getContext('2d');
    const originalImageData = originalCtx.createImageData(originalCanvas.width, originalCanvas.height);
    originalImageData.data.set(window.fjcPixels);
    originalCtx.putImageData(originalImageData, 0, 0);
    
    // Downsample the image
    const downsampledWidth = 128;
    const downsampledHeight = 128;
    const downsampledCanvas = document.createElement('canvas');
    downsampledCanvas.width = downsampledWidth;
    downsampledCanvas.height = downsampledHeight;
    const downsampledCtx = downsampledCanvas.getContext('2d');

    // Flip the canvas vertically
    downsampledCtx.translate(0, downsampledHeight);
    downsampledCtx.scale(1, -1);
    
    downsampledCtx.drawImage(originalCanvas, 0, 0, downsampledWidth, downsampledHeight);
    
    // Convert the downsampled canvas to grayscale
    const imgData = downsampledCtx.getImageData(0, 0, downsampledWidth, downsampledHeight);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const avg = (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
      imgData.data[i] = avg;     // R
      imgData.data[i + 1] = avg; // G
      imgData.data[i + 2] = avg; // B
    }
    downsampledCtx.putImageData(imgData, 0, 0);

    // Convert image data to tf.Tensor with one channel for grayscale
    const imgTensor = tf.browser.fromPixels(downsampledCanvas, 1);

    // For debugging: create an img element to visualize the downsampled image
    const dataUrl = downsampledCanvas.toDataURL();
    let img = document.getElementById('debug-image');
    if (!img) {
        img = document.createElement('img');
        img.id = 'debug-image';
        img.width = 500;  // Set the width for better visualization
        document.getElementById('debug-image-container').appendChild(img);
    }
    img.src = dataUrl;

    const state = {
      marioX: marioXValue,
      marioY: marioYValue,
      marioZ: marioZValue,
      marioHealth: marioHealthRawValue,
      marioNumberOfLives: marioNumberOfLivesValue,
      marioSpeed: marioSpeedValue,
      img: imgTensor,
    };
    return state;
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
// Purley UI code below
//

class MarioHtml {
  constructor(env, agent) {
    this.env = env;
    this.agent = agent;
    this.setUpHTML();
  }

  setUpHTML() {
    const htmlContent = `
        <div id="fjc" style="display: flex; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
            <div id="debug-image-container" style="flex: 1;"></div>
            <div id="reward-graph-container" style="flex: 1; margin-left: 20px;"></div>
            <div style="margin-top: 20px; flex: 1;">
                <label>Mario X Position: <input type="text" id="set-mario-x"></label>
                <label>Mario Y Position: <input type="text" id="set-mario-y"></label>
                <label>Mario Z Position: <input type="text" id="set-mario-z"></label>
                <button type="button" id="set-position-button">Set Position</button>
            </div>
            <div id="mario-values" style="margin-top: 20px; flex: 1;"></div>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', htmlContent);
    document.getElementById('set-position-button').addEventListener('click', this.handleSetMarioPositionButtonClick.bind(this));
  }

  updateRewardGraph(rewards) {
    const graphContainer = document.getElementById('reward-graph-container');
    graphContainer.innerHTML = '';  // Clear previous graph
    
    const graphTitle = document.createElement('h3');
    graphTitle.textContent = 'Reward per Episode';
    graphContainer.appendChild(graphTitle);

    rewards.forEach((reward, episode) => {
      const bar = document.createElement('div');
      bar.style.height = `${reward}px`;
      bar.style.width = '10px';
      bar.style.backgroundColor = 'blue';
      bar.style.marginRight = '2px';
      bar.title = `Episode: ${episode}, Reward: ${reward}`;
      graphContainer.appendChild(bar);
    });
  }

  handleSetMarioPositionButtonClick() {
    const xValue = document.getElementById('set-mario-x').value;
    const yValue = document.getElementById('set-mario-y').value;
    const zValue = document.getElementById('set-mario-z').value;

    if (!xValue || !yValue || !zValue) {
      alert('Please fill in all the fields before setting Mario\'s position.');
      return;
    }

    this.env.setMarioPosition(parseFloat(xValue), parseFloat(yValue), parseFloat(zValue));
  }

  updateHTML() {
    const state = this.env.getState();
    const container = document.getElementById('mario-values');
    container.innerHTML = '';
    this.appendRow(container, 'mario-x', `Mario X Position: ${state.marioX}`);
    this.appendRow(container, 'mario-y', `Mario Y Position: ${state.marioY}`);
    this.appendRow(container, 'mario-z', `Mario Z Position: ${state.marioZ}`);
    this.appendRow(container, 'mario-health', `Mario Health: ${state.marioHealth}`);
    this.appendRow(container, 'mario-lives', `Mario Lives: ${state.marioNumberOfLives}`);
  }

  appendRow(container, id, label) {
    const div = document.createElement('div');
    div.id = id;
    div.textContent = label;
    container.appendChild(div);
    container.appendChild(document.createElement('br'));
  }
}