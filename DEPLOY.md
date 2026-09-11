# Public Deployment

This project is ready to deploy as one Node web service. The storefront,
database API, and customer/admin data all use the same public URL.

## Render

1. Push the project to a GitHub repository.
2. In Render, choose **New > Blueprint** and select that repository.
3. Render detects `render.yaml` and creates the web service with a persistent disk.
4. Open the generated URL, for example `https://saachi-crochet-corner.onrender.com`.

The app URL is the public storefront. Its persistence API is available at
`/api/database`, and the health check is available at `/health`.

The persistent disk keeps `database.json` across deploys and restarts. This is
appropriate for this small shop. For multiple server instances or higher
traffic, migrate the data layer to PostgreSQL using `server/schema.prisma`.

## Local

```powershell
cd saachi
npm start
```

Open `http://localhost:8080`.