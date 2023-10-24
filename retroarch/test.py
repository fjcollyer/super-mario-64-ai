import socket
import time

ra_ip = 'localhost'
ra_port = 55355
buffer_size = 1024  # You can adjust this value as needed

def send_command_to_retroarch(command, expect_response=True):
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.sendto(command.encode(), (ra_ip, ra_port))
        
        # If you expect a response, you can receive it like this:
        if expect_response:
            response, addr = s.recvfrom(buffer_size)
            return response.decode()
        else:
            return None

# Example usage:
response = send_command_to_retroarch("VERSION", expect_response=True)
print(response)

print("Waiting 5 seconds...")
time.sleep(5)

print("Pausing the game...")
response = send_command_to_retroarch("PAUSE_TOGGLE", expect_response=False)

print("Waiting 5 seconds...")
time.sleep(5)

print("Unpausing the game...")
response = send_command_to_retroarch("PAUSE_TOGGLE", expect_response=False)