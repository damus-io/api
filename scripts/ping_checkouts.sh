#!/bin/bash

# Check if exactly one argument is given (the filename)
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <filename of text file containing checkout session UUIDs separated by newlines>"
    echo "Description: This script pings the Damus API to check the status of each checkout session UUID in the file."
    exit 1
fi

# Assign the first command-line argument to FILE
FILE=$1

# Check if file exists
if [ ! -f "$FILE" ]; then
    echo "Error: File does not exist."
    exit 1
fi

# Loop through each line in the file
while IFS= read -r uuid
do
    # URL where UUID is passed as part of the path
    URL="https://api.damus.io/ln-checkout/${uuid}/check-invoice"

    # Make the CURL call and capture the HTTP response code
    RESPONSE=$(curl -s -o response.txt -w "%{http_code}" -X POST "$URL")

    # Read server response from the file
    SERVER_RESPONSE=$(<response.txt)

    # Print UUID and corresponding HTTP response code and server response
    echo "UUID: $uuid"
    echo "HTTP Response Code: $RESPONSE"
    echo "Server Response: $SERVER_RESPONSE"
    echo  # new line for better readability between entries

done < "$FILE"

# Clean up the temporary file
rm response.txt
