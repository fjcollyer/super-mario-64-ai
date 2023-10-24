import socket
import time

RA_IP = 'localhost'
RA_PORT_RETROPAD = 55400
BUFFER_SIZE = 1024

def send_button_press(button):
    print(f"Sending button press: {button}")
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.sendto(button.encode(), (RA_IP, RA_PORT_RETROPAD))
        print(f"Button press for {button} sent successfully.")

def is_retropad_active():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            # Set a timeout for potential response
            s.settimeout(1)
            s.sendto("A".encode(), (RA_IP, RA_PORT_RETROPAD))
            # A response might not be received, but no exception means the port is open.
        return True
    except socket.timeout:
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    if not is_retropad_active():
        print("RetroPad does not seem to be active. Please ensure RetroArch is running and Remote RetroPad is enabled.")
        return
    
    # Test loop to send some buttons
    buttons_to_test = ["A", "B", "D-Pad Up", "D-Pad Down", "D-Pad Left", "D-Pad Right"]
    for button in buttons_to_test:
        send_button_press(button)
        time.sleep(2)  # Let's wait 2 seconds between button presses for clear observation

if __name__ == "__main__":
    main()