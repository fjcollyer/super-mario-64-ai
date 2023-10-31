from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv
from mario_env import MarioEnv

CONFIG = {
    'GAME_URL': 'http://[::]:8000/',
    'ROM_PATH': '/Users/fredrikcollyer/My Drive/fjc/projects/super-mario-64-ai/SuperMario64.z64',
    'ACTIONS': [
        ["ArrowUp"],  # Up
        ["ArrowDown"],  # Down
        ["ArrowLeft"],  # Left
        ["ArrowRight"],  # Right
    ],
    'ACTION_FREQUENCY_PER_SECOND': 2,
    'RESET_X': -1328,
    'RESET_Y': 260,
    'RESET_Z': 4664,
}

def main():
    env = DummyVecEnv([lambda: MarioEnv(CONFIG)])

    model = PPO('CnnPolicy', env, verbose=1)
    model.learn(total_timesteps=1000000)
    model.save("mario_ppo")

if __name__ == "__main__":
    main()