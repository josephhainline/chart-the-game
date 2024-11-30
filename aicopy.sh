#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

DIRECTORY="."
OUTPUT_FILE="$DIRECTORY/allfiles.txt"
TEMP_FILE="$DIRECTORY/temp_allfiles.txt"

echo "Debug: Starting script"

mkdir -p "$(dirname "$OUTPUT_FILE")"
> "$TEMP_FILE"

echo "Debug: Generating file listing"
echo "// File Listing:" > "$OUTPUT_FILE"
find "$DIRECTORY" -type f | 
grep -vE "(allfiles\.txt|temp_allfiles\.txt|\.expo/web/cache/|\.expo|node_modules|build|dist|__tests__|__mocks__|\.git|\.test\.|\.spec\.)" | 
sort | 
while read -r file; do
    if file "$file" | grep -q 'text'; then
        echo "$file" | sed 's|^./||' >> "$OUTPUT_FILE"
    fi
done

echo -e "\n\n" >> "$OUTPUT_FILE"

add_file_content() {
    if [ -f "$1" ]; then
        echo "Debug: Adding file $1"
        echo "// File: $1" >> "$TEMP_FILE"
        cat "$1" >> "$TEMP_FILE"
        echo -e "\n\n" >> "$TEMP_FILE"
    else
        echo "Debug: File not found $1"
    fi
}

process_directory() {
    local dir=$1
    
    echo "Debug: Processing directory $dir"
    if [ -d "$dir" ]; then
        find "$dir" -type f | 
        grep -vE "(allfiles\.txt|temp_allfiles\.txt|\.expo/web/cache/|\.expo|node_modules|build|dist|__tests__|__mocks__|\.git|\.test\.|\.spec\.)" | 
        while read -r file; do
            if file "$file" | grep -q 'text'; then
                add_file_content "$file"
            fi
        done
    else
        echo "Debug: Directory not found $dir"
    fi
}

# Process all directories and files
process_directory "$DIRECTORY"

# Append the temp file to the output file
cat "$TEMP_FILE" >> "$OUTPUT_FILE"
rm "$TEMP_FILE"

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