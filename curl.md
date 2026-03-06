2 types of use cases over this one see it up . 


### Prescription Reminder
```bash
curl -X POST http://localhost:3215/send-patient-reminder \
  -d "uniqueId=test-session" \
  -d "patientId=65a1b2c3d4e5f6a7b8c9d0e2" \
  -d "prescriptionId=65f8a9b0c1d2e3f4a5b6c7d8" \
  -d "reminderType=prescription"
```

### Appointment Reminder
```bash
curl -X POST http://localhost:3215/send-patient-reminder \
  -d "uniqueId=test-session" \
  -d "patientId=65a1b2c3d4e5f6a7b8c9d0e2" \
  -d "reminderType=appointment"
```

### Follow-up Reminder
```bash
curl -X POST http://localhost:3215/send-patient-reminder \
  -d "uniqueId=test-session" \
  -d "patientId=65a1b2c3d4e5f6a7b8c9d0e2" \
  -d "prescriptionId=65f8a9b0c1d2e3f4a5b6c7d8" \
  -d "reminderType=followup"
```

### Medication Reminder
```bash
curl -X POST http://localhost:3215/send-patient-reminder \
  -d "uniqueId=test-session" \
  -d "patientId=65a1b2c3d4e5f6a7b8c9d0e2" \
  -d "prescriptionId=65f8a9b0c1d2e3f4a5b6c7d8" \
  -d "reminderType=medication"
```



curl -X POST http://localhost:3215/send-whatsapp-message \
  -d "uniqueId=your-session-id" \
  -d "phone=919876543210" \
  -d "message=Your appointment is confirmed." \
  -d "personality=Professional healthcare assistant"

# Multiline message
curl -X POST http://localhost:3215/send-whatsapp-message \
  -d "uniqueId=your-session-id" \
  -d "phone=919876543210" \
  -d "message=Hello!\n\nYour appointment is scheduled for:\nDate: March 10, 2026\nTime: 10:00 AM\n\nPlease arrive 10 minutes early."



## or else :

# Create test CSV file first
@"
phone,message,description
919876543210,Hello! We offer software development services,Tech startup
918765432109,Hi! Interested in web development?,E-commerce client
"@ | Out-File -Encoding UTF8 contacts.csv

# Send bulk messages
curl -X POST http://localhost:3215/bulk-whatsapp \
  -F "bulkFile=@contacts.csv" \
  -F "uniqueId=test-session" \
  -F "personality=Professional and friendly" \
  -F "contacts=ALL" \

  -F "excludeContacts="
