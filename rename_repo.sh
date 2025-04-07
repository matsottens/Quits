#!/bin/bash

# This script will rename the current directory to match your GitHub repository

# Wait for 2 seconds to make sure Cursor is closed
sleep 2

# Get current directory path
CURRENT_DIR="$(pwd)"
PARENT_DIR="$(dirname "$CURRENT_DIR")"
NEW_DIR_NAME="quits-frontend"
NEW_DIR_PATH="$PARENT_DIR/$NEW_DIR_NAME"

# Rename the directory
echo "Renaming directory from '$CURRENT_DIR' to '$NEW_DIR_PATH'"
cd ..
mv "Quits componenten" "$NEW_DIR_NAME"

echo "Done! Your directory has been renamed to '$NEW_DIR_PATH'"
echo "Please restart Cursor and open the '$NEW_DIR_PATH' directory" 