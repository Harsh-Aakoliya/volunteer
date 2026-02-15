#!/bin/bash
# Fixes recurring "Could not read workspace metadata from metadata.bin" Gradle error
# Run this before assembleDebug/assembleRelease when the error appears

cd "$(dirname "$0")/../android" || exit 1

echo "Stopping Gradle daemon..."
./gradlew --stop 2>/dev/null || true

echo "Clearing corrupted Gradle cache..."
rm -rf ~/.gradle/caches/8.10.2/kotlin-dsl 2>/dev/null
rm -rf ~/.gradle/caches/8.10.2/scripts 2>/dev/null
rm -rf .gradle 2>/dev/null

echo "Building..."
./gradlew "$@"
