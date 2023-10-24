import subprocess
import pyautogui
import time
import random

# Define paths
CORE_PATH = "/Users/fredrikcollyer/Library/Application Support/RetroArch/cores/mupen64plus_next_libretro.dylib"
ROM_PATH = "/Users/fredrikcollyer/desktop/SuperMario64.z64"
CONFIG_PATH = "/Users/fredrikcollyer/Library/Application Support/RetroArch/config/retroarch-fjc.cfg"
RETROARCH_EXECUTABLE_PATH = "/Applications/RetroArch.app/Contents/MacOS/RetroArch"
USE_CUSTOM_CONFIG = True

NUM_INSTANCES = 1

def launch_instance():
    if USE_CUSTOM_CONFIG:
        process = subprocess.Popen([RETROARCH_EXECUTABLE_PATH, "--config", CONFIG_PATH, "-L", CORE_PATH, ROM_PATH])
    else:
        process = subprocess.Popen([RETROARCH_EXECUTABLE_PATH, "-L", CORE_PATH, ROM_PATH])
    return process.pid

# Launch all instances simultaneously if there are more than one
pids = [launch_instance() for _ in range(NUM_INSTANCES)]

def random_key_press():
    keys = ['a', 'z', 'up', 'left', 'right', 'down']
    key = random.choice(keys)
    pyautogui.keyDown(key)
    time.sleep(0.2)  # Hold key for 200ms. Adjust if necessary.
    pyautogui.keyUp(key)
    print(f"Pressed: {key}")  # Optional, just to see what's being pressed.

# Send a random key press every 5 seconds
while True:
    random_key_press()
    time.sleep(5)