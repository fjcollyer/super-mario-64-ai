import os
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
import numpy as np
from PIL import Image
import io
import time
import random

def launch_game(browser, file_path):
    # Click on the load button
    print("Clicking on load button...")
    load_button = browser.find_element(By.ID, "loadButtonSelenium")
    load_button.click()

    # Sleep for a bit to let the file input dialog open
    print("Sleeping for 2 seconds...")
    time.sleep(2)

    # Set the game ROM to the file input
    print("Setting file input...")
    file_input = browser.find_element(By.ID, "fileInput")
    file_input.send_keys(file_path)

    # Wait for the game to load
    print("Sleeping for 5 seconds...")
    time.sleep(5)

def get_to_start(browser):
    """
    Take actions in the game to get to the actual start.
    """
    delay_per_action = 2
    while True:
        # Take an action
        action = random.randint(0, 3)
        reward, done = execute_game_action(browser, action)

        # Sleep for a bit
        time.sleep(delay_per_action)

        # Check if we're at the start
        if done:
            breakex

def get_screen_data(browser):
    """
    Get the current game screen
    """
    # Take a screenshot and save it
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    filename = f"./screenshots/screenshot_{timestamp}.png"
    browser.save_screenshot(filename)

def reset_game(browser):
    """
    Reset the game to its initial state.
    """
    # Modify this function based on how you can reset your game. 
    # Maybe refresh the page or click a reset button.
    browser.refresh()

def execute_game_action(browser, action):
    """
    Execute the action in the game.
    """
    input_field = browser.find_element(By.ID, "random")
    input_field.send_keys(action)

    # Now actually execute the action in the browser window
    body = browser.find_element(By.TAG_NAME, 'body')
    
    # Hold down the key for 0.5 seconds
    action_chain = ActionChains(browser)
    action_chain.key_down(action, body)
    action_chain.pause(0.5)
    action_chain.key_up(action, body)
    action_chain.perform()

    # Assuming for simplicity that the reward and done can be extracted directly. Modify as needed.
    reward = 0
    done = False
    return reward, done

def main():
    try:
        # Check if the screenshots directory exists, create it if not
        if not os.path.exists("./screenshots"):
            os.mkdir("./screenshots")

        # Start the browser and open the game
        print("Starting browser...")
        browser = webdriver.Chrome()
        browser.get('http://[::]:8000/')
        
        print("Sleeping for 5 seconds...")
        time.sleep(5)

        # Start the game
        print("Starting game...")
        file_path = '/Users/fredrikcollyer/My Drive/fjc/projects/super-mario-64-ai/SuperMario64.z64'
        launch_game(browser, file_path)

        # Take actions in the game to get to the actual start
        print("Taking actions to get to the start...")
        get_to_start(browser)
        
        while True:
            # Get the current game screen
            obs = get_screen_data(browser)

            # Take a random action for demonstration purposes
            action = random.randint(0, 3)
            execute_game_action(browser, action)
            
            # Pause for 5 seconds before the next action/screenshot
            time.sleep(5)

    except KeyboardInterrupt:
        # If you press Ctrl+C, it will close the browser and exit the loop.
        browser.quit()

if __name__ == "__main__":
    main()