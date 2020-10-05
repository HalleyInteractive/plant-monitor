PROJECT_ID=$(gcloud config get-value project)
cd frontend
npm install -g firebase-tools
firebase login:ci --no-localhost
firebase deploy --project $PROJECT_ID
