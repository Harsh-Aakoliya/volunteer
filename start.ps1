# Open first terminal and run npx expo start
Start-Process powershell -ArgumentList "npx expo start" -WorkingDirectory "$PSScriptRoot"

# Open second terminal, cd into Backend and run npm start
Start-Process powershell -ArgumentList "cd Backend; npm start" -WorkingDirectory "$PSScriptRoot"
