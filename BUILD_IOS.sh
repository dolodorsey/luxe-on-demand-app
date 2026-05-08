#!/bin/bash
set -e
echo "LUXE ON DEMAND - iOS Build"
echo "Bundle: com.luxeondemand.app"
npm install
npm run build
npx cap sync ios
npx cap open ios
echo "BUILD COMPLETE - Opening Xcode"
echo "In Xcode: Sign -> Archive -> Distribute -> App Store Connect"
