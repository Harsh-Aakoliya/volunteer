#!/bin/bash

set -e

echo "Fetching connected adb devices..."

# Collect connected devices (macOS Bash 3.2 compatible)
DEVICES=()
while read -r line; do
  DEVICES+=("$line")
done < <(adb devices | awk 'NR>1 && $2=="device" {print $1}')

if [ ${#DEVICES[@]} -eq 0 ]; then
  echo "❌ No adb devices connected."
  exit 1
fi

echo
echo "Available devices:"
INDEX=1
for d in "${DEVICES[@]}"; do
  echo "$INDEX: $d"
  INDEX=$((INDEX+1))
done

echo
read -p "Select device number(s) (e.g. 1 2): " DEVICE_SELECTION

# Split input into array
IFS=' ' read -r -a SELECTED_INDEXES <<< "$DEVICE_SELECTION"

if [ ${#SELECTED_INDEXES[@]} -eq 0 ]; then
  echo "❌ No device selected."
  exit 1
fi

SELECTED_DEVICES=()

for IDX in "${SELECTED_INDEXES[@]}"; do
  # Check numeric
  if ! echo "$IDX" | grep -qE '^[0-9]+$'; then
    echo "❌ Invalid input: $IDX"
    exit 1
  fi

  # Check range
  if [ "$IDX" -lt 1 ] || [ "$IDX" -gt "${#DEVICES[@]}" ]; then
    echo "❌ Device number out of range: $IDX"
    exit 1
  fi

  SELECTED_DEVICES+=("${DEVICES[$((IDX-1))]}")
done

echo
echo "✅ Selected devices:"
for d in "${SELECTED_DEVICES[@]}"; do
  echo " - $d"
done
echo

# File input (drag & drop supported)
read -p "Enter file path (or drag & drop file): " FILE_PATH

# Remove surrounding quotes
FILE_PATH="$(echo "$FILE_PATH" | sed -e "s/^['\"]//" -e "s/['\"]$//")"

if [ ! -f "$FILE_PATH" ]; then
  echo "❌ File not found: $FILE_PATH"
  exit 1
fi

# Extract original filename
ORIGINAL_FILENAME="$(basename "$FILE_PATH")"
BASENAME="${ORIGINAL_FILENAME%.*}"
EXTENSION="${ORIGINAL_FILENAME##*.}"

echo
read -p "Enter target filename (without extension) [default: $BASENAME]: " TARGET_NAME

# Decide final filename
if [ -z "$TARGET_NAME" ]; then
  FINAL_NAME="$ORIGINAL_FILENAME"
else
  FINAL_NAME="${TARGET_NAME}.${EXTENSION}"
fi

TARGET_PATH="/sdcard/$FINAL_NAME"

echo
echo "Pushing file to selected devices..."
echo "From: $FILE_PATH"
echo "To  : $TARGET_PATH"
echo

# Push to each selected device
for DEVICE_ID in "${SELECTED_DEVICES[@]}"; do
  echo "📱 Pushing to $DEVICE_ID..."
  adb -s "$DEVICE_ID" push "$FILE_PATH" "$TARGET_PATH"
done

echo
echo "✅ File pushed successfully to all selected devices!"
