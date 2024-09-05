#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Directory containing the React Native app
DIRECTORY="."

# Output file
OUTPUT_FILE="$DIRECTORY/allfiles.txt"

# Create output directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Clear the output file
> "$OUTPUT_FILE"

# Function to add file contents to the output file
add_file_content() {
    if [ -f "$1" ]; then
        echo "Debug: Adding file $1"
        echo "// File: $1" >> "$OUTPUT_FILE"
        cat "$1" >> "$OUTPUT_FILE"
        echo -e "\n\n" >> "$OUTPUT_FILE"
    else
        echo "Debug: File not found $1"
    fi
}

# Important root files
echo "Debug: Processing root files"
for file in .gitignore package.json tsconfig.json babel.config.js app.json expo-env.d.ts; do
    add_file_content "$DIRECTORY/$file"
done

# Function to process directories
process_directory() {
    local dir=$1
    
    echo "Debug: Processing directory $dir"
    if [ -d "$dir" ]; then
        find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) | 
        grep -vE "(node_modules|build|dist|__tests__|__mocks__|.test.|.spec.)" |
        while read -r file; do
            add_file_content "$file"
        done
    else
        echo "Debug: Directory not found $dir"
    fi
}

# Process apps directory
echo "Debug: Processing app directory"
process_directory "$DIRECTORY/app"

# Process components directory
echo "Debug: Processing components directory"
process_directory "$DIRECTORY/components"

# Process constants directory
echo "Debug: Processing constants directory"
process_directory "$DIRECTORY/constants"

# Process assets directory
echo "Debug: Processing assets directory"
process_directory "$DIRECTORY/assets"

echo "Contents of important files have been copied to $OUTPUT_FILE"

# Calculate approximate token count
total_chars=$(wc -m < "$OUTPUT_FILE")
total_tokens=$((total_chars / 4))
formatted_tokens=$(printf "%'d\n" $total_tokens)
echo "Approximate tokens: $formatted_tokens"

# Copy to clipboard (macOS)
cat "$OUTPUT_FILE" | pbcopy
echo "Contents copied to clipboard using pbcopy"

echo "Debug: Script completed"
