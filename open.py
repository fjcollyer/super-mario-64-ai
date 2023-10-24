import subprocess
import time
import pyautogui

# Define paths
CORE_PATH = "/Users/fredrikcollyer/Library/Application Support/RetroArch/cores/mupen64plus_next_libretro.dylib"
ROM_PATH = "/Users/fredrikcollyer/desktop/SuperMario64.z64"
CONFIG_PATH = "/Users/fredrikcollyer/Library/Application Support/RetroArch/config/retroarch-fjc.cfg"
RETROARCH_EXECUTABLE_PATH = "/Applications/RetroArch.app/Contents/MacOS/RetroArch"
USE_CUSTOM_CONFIG = True

NUM_INSTANCES = 1
WINDOW_SIZE = (720, 506)  # Adjust as needed for your screen
WINDOW_LOCATIONS = [(0, 0), (720, 0), (0, 506), (720, 506)]

def activate_window_by_pid(pid):
    script = f'''
    tell application "System Events"
        set frontmost of every process whose unix id is {pid} to true
    end tell
    '''
    subprocess.run(["osascript", "-e", script])

def launch_instance():
    if USE_CUSTOM_CONFIG:
        process = subprocess.Popen([RETROARCH_EXECUTABLE_PATH, "--config", CONFIG_PATH, "-L", CORE_PATH, ROM_PATH])
    else:
        process = subprocess.Popen([RETROARCH_EXECUTABLE_PATH, "-L", CORE_PATH, ROM_PATH])
    return process.pid

def set_window_position_and_size(pid, x, y, width, height):
    # This function can be expanded upon if you wish to position and size windows.
    # For now, it simply prints out that it might not be needed.
    print("Maybe not needed")

def launch_and_position_instance(x, y, width, height):
    pid = launch_instance()
    time.sleep(3)  # Wait for 3 seconds after launching each instance
    set_window_position_and_size(pid, x, y, width, height)
    return pid

def press_a_on_instance(pid, duration=1):  # default duration is 1 second
    print("Activating window")
    activate_window_by_pid(pid)
    time.sleep(2)  # Give some time for the window to become active
    print("Pressing A")
    pyautogui.keyDown('a')
    time.sleep(duration)  # Hold the 'a' key for the specified duration
    pyautogui.keyUp('a')
    print("Done")
    print()

# Launch and position each instance one-by-one
pids = []
for i in range(NUM_INSTANCES):
    pid = launch_and_position_instance(WINDOW_LOCATIONS[i][0], WINDOW_LOCATIONS[i][1], WINDOW_SIZE[0], WINDOW_SIZE[1])
    pids.append(pid)

# Press A on the first instance every 5 seconds
while True:
    press_a_on_instance(pids[0], duration=2)
    time.sleep(5)