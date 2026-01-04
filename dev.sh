#!/bin/bash

# Open Cursor in current directory
cursor .
sleep 1

# Open integrated terminal (Ctrl + `)
osascript -e 'tell application "System Events" to keystroke "`" using control down'
sleep 0.3

# Type command
osascript -e 'tell application "System Events" to keystroke "npm start"'
sleep 0.2

# Press Enter
osascript -e 'tell application "System Events" to key code 36'
sleep 1

# Ensure Cursor is focused
osascript -e 'tell application "Cursor" to activate'
sleep 0.2

# Split terminal (Cmd + \)
osascript -e 'tell application "System Events" to keystroke "\\" using command down'

# Type command
osascript -e 'tell application "System Events" to keystroke "cd Backend && npm start"'
sleep 0.2

# Press Enter
osascript -e 'tell application "System Events" to key code 36'
sleep 1