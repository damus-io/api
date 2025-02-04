if [[ -z "$1" ]]; then
    echo "Usage: $0 <path_to_json_file>"
    echo "Description: This script outputs checkout sessions from the JSON where the invoice is not null and completed is false."
    exit 1
fi

if [[ ! -f "$1" ]]; then
    echo "Error: File does not exist."
    echo "Usage: $0 <path_to_json_file>"
    exit 1
fi

jq '.checkout_sessions |
    to_entries |
    map(select(.value.invoice != null and .value.completed == false)) |
    from_entries' "$1"
