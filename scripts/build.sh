#!/bin/bash

# Build script for KinoLiveAudio
# This script builds the JavaScript assets using kino-bundler

set -e  # Exit on error

echo "🎵 Building KinoLiveAudio assets..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    echo "Please install npm (it usually comes with Node.js)"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo "✓ npm version: $(npm --version)"
echo ""

# Navigate to assets directory
cd assets

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build
echo "🔨 Building assets..."
npm run build
cp packs/live_audio/pcm-processor.js ../lib/assets/live_audio/build/

# Check if build was successful
if [ -f "../lib/assets/live_audio/build/main.js" ] && [ -f "../lib/assets/live_audio/build/main.css" ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "Built files:"
    ls -lh ../lib/assets/live_audio/build/
    echo ""
    echo "You can now use KinoLiveAudio in your Livebook!"
else
    echo ""
    echo "❌ Build failed - output files not found"
    exit 1
fi
