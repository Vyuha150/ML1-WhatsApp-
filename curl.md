
# in this one pass the msg to this curl request from your side and it will send it to the specified number automatically 
# Multiline message
curl -X POST http://localhost:3215/send-whatsapp-message \
  -d "uniqueId=your-session-id" \
  -d "phone=919876543210" \
  -d "message=Hello!\n\nYour appointment is scheduled for:\nDate: March 10, 2026\nTime: 10:00 AM\n\nPlease arrive 10 minutes early."





## This will creates a contacts.csv file automatically and to fill this use the data you have in the second column and first column should have number.
`
@"
phone,message,description
919876543210,Hello! We offer software development services,Tech startup
918765432109,Hi! Interested in web development?,E-commerce client
"@ | Out-File -Encoding UTF8 contacts.csv
`
# Send bulk message
keep session id as` n ` and personality as this: ``
`
curl -X POST http://localhost:3215/bulk-whatsapp \
  -F "bulkFile=@contacts.csv" \
  -F "uniqueId=test-session" \
  -F "personality=Professional and friendly" \
  -F "contacts=ALL" \
  `

