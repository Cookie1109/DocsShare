# Firebase Service Account Setup

## Required Firebase Service Account Key

This project requires a Firebase service account key file for backend authentication.

### Setup Instructions:

1. **Download your Firebase service account key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

2. **Place the file in the backend directory:**
   ```
   backend/docsshare-35adb-firebase-adminsdk-fbsvc-[your-key-id].json
   ```

3. **Update the path in firebaseAdmin.js:**
   ```javascript
   const serviceAccount = require('./docsshare-35adb-firebase-adminsdk-fbsvc-[your-key-id].json');
   ```

### ⚠️ Security Notes:

- **NEVER** commit service account keys to version control
- Keep the JSON file local only
- For production, use environment variables or secure secret management
- The .gitignore file is configured to prevent accidental commits

### Environment Variables Alternative:

Instead of using a JSON file, you can use environment variables:

```bash
# In your .env file
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
```

Then update firebaseAdmin.js to use environment variables for production.