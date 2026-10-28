<?php
// Copy OUTSIDE the served website into the deployment account's private .aigb-sync/config.php.
// Keep the directory 0700 and this file 0600. Never put actual secrets in this repository.
return [
    'enabled' => false,
    'origin' => 'https://amigoingbroke.me',
    'client_id' => '',
    'client_secret' => '',
    'redirect_uri' => 'https://amigoingbroke.me/api/drive-sync.php?action=callback',
    'state_directory' => '', // Absolute private path outside the website; one encrypted database.
    'encryption_key' => '', // Base64-encoded random 32-byte key; keep a separate secure backup.
];
