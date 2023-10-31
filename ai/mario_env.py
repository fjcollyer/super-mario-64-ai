import base64
import io
import json
import sys
import time
import gym
from gym import spaces
import numpy as np
import asyncio
import websockets
from PIL import Image
import uuid

class MarioEnv(gym.Env):
    def __init__(self, config):
        print('__init__()')
        super(MarioEnv, self).__init__()

        # Action and observation spaces
        self.action_space = spaces.Discrete(len(config['ACTIONS']))
        self.observation_space = spaces.Box(low=0, high=255, shape=(256, 256, 1), dtype=np.uint8)

        # Configuration
        self.config = config

        # Mario values
        self.mario_values = None
        self.done = False

    def reset(self):
        # TODO
        return self._get_observation()

    def step(self, action):
        print('step()')
        if not self.mario_values:
            print('No mario values: step()')
            sys.exit(1)

        self._send_action(action)
        reward = self._calculate_reward()
        self.done = self.mario_values['lives'] == 0
        time.sleep(1 / self.config['ACTION_FREQUENCY_PER_SECOND'])
        return self._get_observation(), reward, self.done, {}

    def _calculate_reward(self):
        print('_calculate_reward()')
        if not self.mario_values:
            print('No mario values: _calculate_reward()')
            sys.exit(1)

        return self.mario_values['x']


    def _get_observation(self):
        print('_get_observation()')
        if not self.mario_values:
            print('No mario values: _get_observation()')
            sys.exit(1)
        
        # Check if 'image' is in the mario_values instead of 'pixels'
        if self.mario_values and 'image' in self.mario_values:
            print('Got observation!')
            
            # Decode the Data URL to get the image bytes
            data_url = self.mario_values['image']
            image_data = base64.b64decode(data_url.split(',')[1])
            
            # Convert the image bytes to a numpy array
            image = Image.open(io.BytesIO(image_data))
            pixel_data = np.array(image)
            
            # Assuming you want to continue using just the red channel
            pixel_data = pixel_data[:, :, 0].reshape((256, 256, 1))
            
            # Save the image for debugging
            print(f'Saving screenshot to ./screenshot/step{self.mario_values["xPosition"]}.png')
            img = Image.fromarray(pixel_data, 'L')
            img.save(f'./screenshot/step{self.mario_values["xPosition"]}.png')

            return pixel_data
        else:
            return np.zeros((256, 256, 1), dtype=np.uint8)

    def render(self, mode='human'):
        print('render()')
        pass

    def close(self):
        print('close()')
        self.websocket.close()
