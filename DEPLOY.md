# Public Deployment

This project can be published for free as a static website with GitHub Pages.
The storefront works without a paid server. Customer/admin data is saved in
each visitor's browser through localStorage. GitHub Pages cannot provide a
shared database or receive writes from the website.

## Free GitHub Pages

1. Push the project to GitHub.
2. Open the repository's **Settings > Pages**.
3. Under **Build and deployment**, choose **GitHub Actions**.
4. Push a new commit or run the **Deploy Saachi Crochet Corner** workflow.
5. Open `https://saksham1588.github.io/saachi-crochet-corner/`.

The GitHub Actions workflow is in `.github/workflows/free-pages.yml` and deploys
the site automatically on every push to `main`.

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