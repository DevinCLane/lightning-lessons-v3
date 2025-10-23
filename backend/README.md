```
pnpm install
pnpm run dev
```

```
open http://localhost:8080
```

## Useful GCP Cloud Run Commands

### Deploy

```
gcloud run deploy my-app --source . --allow-unauthenticated --env-vars-file=.env
```

### Update environment variables in GCP Cloud Run without a full redeploy

```
gcloud run services update lightning-lessons \
    --update-env-vars code=code \
    --region us-east4
```

### Show all the current environment variables

```
gcloud run services describe lightning-lessons
```
